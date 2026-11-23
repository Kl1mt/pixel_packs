import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  EconomyStateSchema,
  OpenPackResponseSchema,
  PullHistoryResponseSchema,
  createSeededRng,
  rarityRank,
  type Rng,
} from '@pixel-packs/shared';
import { grantPacks, resetOnboarding, setOddsOverride } from '../admin/index.js';
import {
  ledger,
  mintCounters,
  packInventory,
  packOpenings,
  packTypes,
  pityCounters,
  seasons,
  userCards,
} from '../db/schema.js';
import { createTestApp, key, newPlayer, type Client, type TestApp } from '../testing/harness.js';

/** Seeded, and can be told to fail on the next draw (atomicity tests). */
const seeded = createSeededRng('t10-opening');
let failNext = false;
const rng: Rng = {
  int(max) {
    if (failNext) {
      failNext = false;
      throw new Error('boom');
    }
    return seeded.int(max);
  },
};

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({ rng });
});
afterAll(() => t.close());

async function open(c: Client, packTypeId = 'realm:mossgrove', idempotencyKey = key()) {
  const res = await c.post('/api/packs/open', { packTypeId, idempotencyKey });
  return { res, body: res.statusCode < 300 ? OpenPackResponseSchema.parse(res.json()) : null };
}

/** A player past onboarding. */
async function veteran() {
  const p = await newPlayer(t.app);
  await open(p.c, 'realm:mossgrove');
  await open(p.c, 'realm:starhollow');
  return p;
}

describe('opening packs', () => {
  it('scripts the first two realm packs (Epic, then Foil) without touching pity', async () => {
    const { c, userId } = await newPlayer(t.app);
    const first = await open(c, 'realm:mossgrove');
    expect(first.res.statusCode).toBe(201);
    const featured = first.body?.opening.cards[4];
    expect(first.body?.opening.scripted).toBe(true);
    expect(featured?.rarity).toBe('epic');
    const second = await open(c, 'realm:starhollow');
    expect(second.body?.opening.cards[4]?.variant).toBe('foil');
    expect(
      await t.db.db.select().from(pityCounters).where(eq(pityCounters.userId, userId)),
    ).toEqual([]);

    const me = await c.get('/api/auth/me');
    expect(me.json()).toMatchObject({ user: { onboardingStep: 2 } });
  });

  it('stores copies, ledger entries and pity, and spends the pack', async () => {
    const { c, userId } = await veteran();
    await grantPacks(t.db.db, userId, 'realm:mossgrove', 1);
    const { res, body } = await open(c);
    expect(res.statusCode).toBe(201);
    const opening = body?.opening;
    if (!opening) throw new Error('no opening');
    expect(opening.scripted).toBe(false);
    expect(opening.cards.map((x) => x.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(opening.revealOrder.at(-1)).toBe(5);
    expect(rarityRank(opening.cards[4]?.rarity ?? 'common')).toBeGreaterThanOrEqual(1);

    const copies = await t.db.db
      .select()
      .from(userCards)
      .where(eq(userCards.packOpeningId, opening.id));
    expect(copies.map((x) => x.id).sort()).toEqual(opening.cards.map((x) => x.userCardId).sort());
    const pulls = await t.db.db.select().from(ledger).where(eq(ledger.refId, opening.id));
    expect(pulls.filter((l) => l.reason === 'pull')).toHaveLength(5);
    expect(pulls.find((l) => l.reason === 'openPack')).toMatchObject({ delta: -1 });
    const [pity] = await t.db.db.select().from(pityCounters).where(eq(pityCounters.userId, userId));
    expect(pity?.pityGroup).toBe('realm');

    const none = await open(c);
    expect(none.res.statusCode).toBe(409);
    expect(none.res.json()).toMatchObject({ error: { code: 'noPacks' } });
  });

  it('returns the stored result for a repeated key and rejects a reused key for another pack', async () => {
    const { c, userId } = await veteran();
    await grantPacks(t.db.db, userId, 'realm:mossgrove', 2);
    const k = key();
    const a = await open(c, 'realm:mossgrove', k);
    const b = await open(c, 'realm:mossgrove', k);
    expect(b.res.statusCode).toBe(200);
    expect(b.body?.replayed).toBe(true);
    expect(b.body?.opening).toEqual(a.body?.opening);
    const [inv] = await t.db.db
      .select()
      .from(packInventory)
      .where(eq(packInventory.userId, userId))
      .orderBy(packInventory.packTypeId);
    expect(inv).toMatchObject({ packTypeId: 'realm:mossgrove', count: 1 });
    const other = await open(c, 'realm:starhollow', k);
    expect(other.res.json()).toMatchObject({ error: { code: 'idempotencyConflict' } });
  });

  it('is atomic: a failure mid-roll leaves no trace', async () => {
    const { c, userId } = await veteran();
    await grantPacks(t.db.db, userId, 'realm:mossgrove', 1);
    const before = await t.db.db.select().from(userCards).where(eq(userCards.userId, userId));
    failNext = true;
    const { res } = await open(c);
    expect(res.statusCode).toBe(500);
    const after = await t.db.db.select().from(userCards).where(eq(userCards.userId, userId));
    expect(after).toHaveLength(before.length);
    const [inv] = await t.db.db
      .select()
      .from(packInventory)
      .where(eq(packInventory.userId, userId));
    expect(inv?.count).toBe(1);
    expect((await open(c)).res.statusCode).toBe(201);
  });

  it('gives Void and Glitch copies consecutive mint numbers per card and variant', async () => {
    const { c, userId } = await veteran();
    await grantPacks(t.db.db, userId, 'realm:mossgrove', 3);
    await setOddsOverride(t.db.db, userId, { rarity: 'mythic', variant: 'void', packs: 3 });
    const numbers: number[] = [];
    for (let i = 0; i < 3; i++) {
      const featured = (await open(c)).body?.opening.cards[4];
      expect(featured).toMatchObject({ rarity: 'mythic', variant: 'void' });
      numbers.push(featured?.mintNumber ?? 0);
    }
    const counters = await t.db.db.select().from(mintCounters);
    const total = counters
      .filter((m) => m.variant === 'void')
      .reduce((s, m) => s + m.lastNumber, 0);
    expect(total).toBeGreaterThanOrEqual(3);
    // Two Mythics per realm can share the featured slot; per card the numbers are 1, 2, …
    const voids = await t.db.db.select().from(userCards).where(eq(userCards.variant, 'void'));
    const byCard = new Map<string, number[]>();
    for (const v of voids)
      byCard.set(v.cardId, [...(byCard.get(v.cardId) ?? []), v.mintNumber ?? 0]);
    for (const list of byCard.values()) {
      expect(list.sort((x, y) => x - y)).toEqual(list.map((_, i) => i + 1));
    }
    expect(numbers.every((n) => n >= 1)).toBe(true);
  });

  it('stamps First Edition only during the pack release season', async () => {
    const { c, userId } = await veteran();
    await grantPacks(t.db.db, userId, 'realm:starhollow', 1);
    await t.db.db
      .update(seasons)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(seasons.id, 0));
    await t.db.db
      .insert(seasons)
      .values({ id: 1, name: 'Season 1', startsAt: new Date(Date.now() - 1000) });
    await t.db.db
      .update(packTypes)
      .set({ releaseSeason: 1 })
      .where(eq(packTypes.id, 'realm:starhollow'));
    try {
      const { body } = await open(c, 'realm:starhollow');
      expect(body?.opening.cards.every((x) => x.edition?.season === 1)).toBe(true);
    } finally {
      await t.db.db
        .update(packTypes)
        .set({ releaseSeason: 0 })
        .where(eq(packTypes.id, 'realm:starhollow'));
      // Copies reference Season 1 now; push it into the future instead of deleting it.
      await t.db.db
        .update(seasons)
        .set({ startsAt: new Date('2100-01-01') })
        .where(eq(seasons.id, 1));
      await t.db.db.update(seasons).set({ endsAt: null }).where(eq(seasons.id, 0));
    }
  });

  it('marks NEW only for cards the player did not own', async () => {
    const { c, userId } = await newPlayer(t.app);
    await resetOnboarding(t.db.db, userId);
    const { body } = await open(c);
    const ids = body?.opening.cards.map((x) => x.cardId) ?? [];
    const firsts = ids.map((id, i) => ids.indexOf(id) === i);
    expect(body?.opening.cards.map((x) => x.isNew)).toEqual(firsts);
  });
});

describe('resume, reveal and history', () => {
  it('resumes the unrevealed opening until it is marked revealed', async () => {
    const { c } = await newPlayer(t.app);
    const { body } = await open(c);
    const id = body?.opening.id;
    const pending = await c.get('/api/packs/openings/pending');
    expect(pending.json()).toMatchObject({ opening: { id, revealedAt: null } });
    const state = EconomyStateSchema.parse((await c.get('/api/economy')).json());
    expect(state.pendingOpeningId).toBe(id);

    expect((await c.post(`/api/packs/openings/${id}/revealed`)).statusCode).toBe(204);
    expect((await c.post(`/api/packs/openings/${id}/revealed`)).statusCode).toBe(204);
    expect((await c.get('/api/packs/openings/pending')).json()).toEqual({ opening: null });

    const stranger = await newPlayer(t.app);
    const res = await stranger.c.post(`/api/packs/openings/${id}/revealed`);
    expect(res.statusCode).toBe(404);
  });

  it('pages revealed openings newest first', async () => {
    const { c, userId } = await veteran();
    await grantPacks(t.db.db, userId, 'realm:mossgrove', 3);
    for (let i = 0; i < 3; i++) await open(c);
    const all = await t.db.db.select().from(packOpenings).where(eq(packOpenings.userId, userId));
    for (const o of all) await c.post(`/api/packs/openings/${o.id}/revealed`);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const q: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const page = PullHistoryResponseSchema.parse(
        (await c.get(`/api/packs/history?limit=2${q}`)).json(),
      );
      seen.push(...page.openings.map((o) => o.id));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    const times = all
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id < a.id ? -1 : 1))
      .map((o) => o.id);
    expect(seen).toEqual(times);
    expect((await c.get('/api/packs/history?cursor=nope')).statusCode).toBe(400);
  });

  it('serves the odds without a session', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/packs/odds' });
    const mythic = res
      .json<{ packs: { packTypeId: string; featuredRarity: object }[] }>()
      .packs.at(-1);
    expect(mythic).toMatchObject({
      packTypeId: 'mythic',
      featuredRarity: { epic: 75, legendary: 20, mythic: 5 },
    });
  });
});
