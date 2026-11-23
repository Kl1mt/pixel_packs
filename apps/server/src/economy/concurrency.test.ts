/**
 * Concurrency (GDD §26): runs on Postgres when TEST_DATABASE_URL is set (CI), where the
 * requests really run in parallel; on PGlite otherwise, where they are serialised.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { grantCurrency, grantPacks, setOddsOverride } from '../admin/index.js';
import { packInventory, userCards, wallets } from '../db/schema.js';
import { createTestApp, key, newPlayer, type TestApp } from '../testing/harness.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
let t: TestApp;
beforeAll(async () => {
  t = await createTestApp(databaseUrl ? { databaseUrl } : {});
});
afterAll(() => t.close());

const statuses = (rs: { statusCode: number }[]) => rs.map((r) => r.statusCode).sort();

describe(`concurrency on ${databaseUrl ? 'Postgres' : 'PGlite'}`, () => {
  it('never opens more packs than the inventory holds', async () => {
    const { c, userId } = await newPlayer(t.app);
    await grantPacks(t.db.db, userId, 'realm:mossgrove', 4); // 5 with the starter pack
    const rs = await Promise.all(
      Array.from({ length: 8 }, () =>
        c.post('/api/packs/open', { packTypeId: 'realm:mossgrove', idempotencyKey: key() }),
      ),
    );
    expect(statuses(rs)).toEqual([201, 201, 201, 201, 201, 409, 409, 409]);
    const copies = await t.db.db.select().from(userCards).where(eq(userCards.userId, userId));
    expect(copies).toHaveLength(25);
    const [inv] = await t.db.db
      .select()
      .from(packInventory)
      .where(
        and(eq(packInventory.userId, userId), eq(packInventory.packTypeId, 'realm:mossgrove')),
      );
    expect(inv?.count).toBe(0);
  });

  it('opens once for parallel requests with the same key', async () => {
    const { c, userId } = await newPlayer(t.app);
    const k = key();
    const rs = await Promise.all(
      Array.from({ length: 6 }, () =>
        c.post('/api/packs/open', { packTypeId: 'realm:starhollow', idempotencyKey: k }),
      ),
    );
    expect(statuses(rs)).toEqual([200, 200, 200, 200, 200, 201]);
    const ids = new Set(rs.map((r) => r.json<{ opening: { id: string } }>().opening.id));
    expect(ids.size).toBe(1);
    const copies = await t.db.db.select().from(userCards).where(eq(userCards.userId, userId));
    expect(copies).toHaveLength(5);
  });

  it('pays free packs, the calendar and purchases once', async () => {
    const { c, userId } = await newPlayer(t.app);
    await grantCurrency(t.db.db, userId, 'gold', 300);
    const [free, calendar, buys] = await Promise.all([
      Promise.all(
        Array.from({ length: 5 }, () => c.post('/api/rewards/free-pack', { realm: 'mossgrove' })),
      ),
      Promise.all(Array.from({ length: 5 }, () => c.post('/api/rewards/calendar'))),
      Promise.all(
        Array.from({ length: 6 }, () =>
          c.post('/api/packs/buy', { packTypeId: 'realm:mossgrove', idempotencyKey: key() }),
        ),
      ),
    ]);
    expect(statuses(free)).toEqual([200, 409, 409, 409, 409]);
    expect(statuses(calendar)).toEqual([200, 409, 409, 409, 409]);
    expect(statuses(buys)).toEqual([200, 200, 200, 409, 409, 409]);
    const [w] = await t.db.db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(w?.gold).toBe(40); // 300 − 3 × 100 + calendar day 1
    const [inv] = await t.db.db
      .select()
      .from(packInventory)
      .where(
        and(eq(packInventory.userId, userId), eq(packInventory.packTypeId, 'realm:mossgrove')),
      );
    expect(inv?.count).toBe(1 + 1 + 3); // starter + free + bought
  });

  it('hands out unique, gap-free mint numbers across players', async () => {
    const players = await Promise.all(Array.from({ length: 6 }, () => newPlayer(t.app)));
    for (const p of players) {
      await grantPacks(t.db.db, p.userId, 'mythic', 2);
      await setOddsOverride(t.db.db, p.userId, {
        rarity: 'legendary',
        variant: 'glitch',
        packs: 2,
      });
    }
    const rs = await Promise.all(
      players.flatMap((p) =>
        [0, 1].map(() =>
          p.c.post('/api/packs/open', { packTypeId: 'mythic', idempotencyKey: key() }),
        ),
      ),
    );
    expect(rs.every((r) => r.statusCode === 201)).toBe(true);
    const mine = await t.db.db
      .select({ cardId: userCards.cardId })
      .from(userCards)
      .where(
        and(
          inArray(
            userCards.userId,
            players.map((p) => p.userId),
          ),
          eq(userCards.variant, 'glitch'),
        ),
      );
    // Every Glitch copy of those cards ever pulled, by anyone: numbers must be 1…N.
    const glitches = await t.db.db
      .select()
      .from(userCards)
      .where(
        and(
          inArray(
            userCards.cardId,
            mine.map((m) => m.cardId),
          ),
          eq(userCards.variant, 'glitch'),
          isNotNull(userCards.mintNumber),
        ),
      );
    expect(glitches.length).toBeGreaterThanOrEqual(12);
    const byCard = new Map<string, number[]>();
    for (const g of glitches)
      byCard.set(g.cardId, [...(byCard.get(g.cardId) ?? []), g.mintNumber ?? 0]);
    for (const nums of byCard.values()) {
      const sorted = [...nums].sort((a, b) => a - b);
      expect(new Set(sorted).size).toBe(sorted.length);
      expect(sorted).toEqual(sorted.map((_, i) => i + 1));
    }
  });
});
