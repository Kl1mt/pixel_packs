import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CollectionResponseSchema,
  OpenPackResponseSchema,
  PullHistoryResponseSchema,
  rarityRank,
  type PackOpening,
} from '@pixel-packs/shared';
import { createTestApp, key, newPlayer, type Client, type TestApp } from '../testing/harness.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

/** Opens one of the starter packs and marks it revealed. */
async function openStarter(c: Client, realm: 'mossgrove' | 'starhollow'): Promise<PackOpening> {
  const res = await c.post('/api/packs/open', {
    packTypeId: `realm:${realm}`,
    idempotencyKey: key(),
  });
  const { opening } = OpenPackResponseSchema.parse(res.json());
  await c.post(`/api/packs/openings/${opening.id}/revealed`);
  return opening;
}

const history = async (c: Client, q = '') =>
  PullHistoryResponseSchema.parse((await c.get(`/api/packs/history?${q}`)).json()).openings;

describe('collection', () => {
  it('lists every live copy with its traits, and drops dusted ones', async () => {
    const { c } = await newPlayer(t.app);
    expect(CollectionResponseSchema.parse((await c.get('/api/cards')).json()).copies).toEqual([]);
    const opening = await openStarter(c, 'mossgrove');
    const { copies } = CollectionResponseSchema.parse((await c.get('/api/cards')).json());
    expect(copies.map((x) => x.userCardId).sort()).toEqual(
      opening.cards.map((x) => x.userCardId).sort(),
    );
    const pulled = opening.cards[0];
    const own = copies.find((x) => x.userCardId === pulled?.userCardId);
    expect(own).toMatchObject({
      cardId: pulled?.cardId,
      variant: pulled?.variant,
      stars: 1,
      mintNumber: pulled?.mintNumber,
      source: 'pack',
      accountBound: false,
    });

    await c.post('/api/cards/dust', { userCardIds: [pulled?.userCardId] });
    const after = CollectionResponseSchema.parse((await c.get('/api/cards')).json()).copies;
    expect(after).toHaveLength(4);
  });

  it('only shows your own copies and needs a session', async () => {
    const a = await newPlayer(t.app);
    const b = await newPlayer(t.app);
    await openStarter(a.c, 'mossgrove');
    expect(CollectionResponseSchema.parse((await b.c.get('/api/cards')).json()).copies).toEqual([]);
    expect((await t.app.inject({ method: 'GET', url: '/api/cards' })).statusCode).toBe(401);
  });
});

describe('pull history filters', () => {
  it('filters by pack type, minimum rarity and variant', async () => {
    const { c } = await newPlayer(t.app);
    const moss = await openStarter(c, 'mossgrove');
    const star = await openStarter(c, 'starhollow');
    expect((await history(c)).map((o) => o.id)).toEqual([star.id, moss.id]);
    expect((await history(c, 'packTypeId=realm:mossgrove')).map((o) => o.id)).toEqual([moss.id]);

    // Starter packs are scripted: Mossgrove features an Epic, so Epic+ finds it.
    const best = (o: PackOpening) => Math.max(...o.cards.map((x) => rarityRank(x.rarity)));
    const epicPlus = await history(c, 'minRarity=epic');
    expect(epicPlus.map((o) => o.id)).toEqual(
      [star, moss].filter((o) => best(o) >= rarityRank('epic')).map((o) => o.id),
    );
    expect(epicPlus.map((o) => o.id)).toContain(moss.id);

    const withFoil = await history(c, 'variant=foil');
    expect(withFoil.map((o) => o.id)).toEqual(
      [star, moss].filter((o) => o.cards.some((x) => x.variant === 'foil')).map((o) => o.id),
    );
    expect((await c.get('/api/packs/history?minRarity=shiny')).statusCode).toBe(400);
  });
});
