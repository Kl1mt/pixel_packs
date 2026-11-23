import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { DustExtrasPreviewSchema, DustResponseSchema, type Variant } from '@pixel-packs/shared';
import { ledger, userCards } from '../db/schema.js';
import { createTestApp, newPlayer, type TestApp } from '../testing/harness.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

/** Inserts copies directly (MOS-001 is a Common, MOS-005 an Uncommon). */
async function give(
  userId: string,
  cardId: string,
  n: number,
  over: { variant?: Variant; accountBound?: boolean; mintNumber?: number } = {},
): Promise<string[]> {
  const rows = await t.db.db
    .insert(userCards)
    .values(
      Array.from({ length: n }, () => ({
        userId,
        cardId,
        variant: over.variant ?? 'normal',
        source: 'pack' as const,
        accountBound: over.accountBound ?? false,
        mintNumber: over.mintNumber ?? null,
      })),
    )
    .returning({ id: userCards.id });
  return rows.map((r) => r.id);
}

describe('dusting', () => {
  it('dusts picked copies, special ones included, and credits Stardust', async () => {
    const { c, userId } = await newPlayer(t.app);
    const [normal] = await give(userId, 'MOS-001', 1);
    const [foil] = await give(userId, 'MOS-005', 1, { variant: 'foil' });
    const res = await c.post('/api/cards/dust', { userCardIds: [normal, foil] });
    expect(res.statusCode).toBe(200);
    // Common 5 + Uncommon Foil 15 × 2.
    expect(DustResponseSchema.parse(res.json())).toMatchObject({
      dusted: 2,
      dust: 35,
      wallet: { dust: 35 },
    });
    const live = await t.db.db
      .select()
      .from(userCards)
      .where(and(eq(userCards.userId, userId), isNull(userCards.removedAt)));
    expect(live).toHaveLength(0);
    const entries = await t.db.db.select().from(ledger).where(eq(ledger.userId, userId));
    expect(entries.filter((e) => e.reason === 'dust' && e.userCardId !== null)).toHaveLength(2);

    const again = await c.post('/api/cards/dust', { userCardIds: [normal] });
    expect(again.statusCode).toBe(404);
  });

  it('rejects account-bound copies and copies of other players, all or nothing', async () => {
    const { c, userId } = await newPlayer(t.app);
    const other = await newPlayer(t.app);
    const [mine] = await give(userId, 'MOS-001', 1);
    const [bound] = await give(userId, 'MOS-001', 1, { accountBound: true });
    const [theirs] = await give(other.userId, 'MOS-001', 1);
    const a = await c.post('/api/cards/dust', { userCardIds: [mine, bound] });
    expect(a.json()).toMatchObject({ error: { code: 'cannotDust' } });
    const b = await c.post('/api/cards/dust', { userCardIds: [mine, theirs] });
    expect(b.statusCode).toBe(404);
    const live = await t.db.db.select().from(userCards).where(isNull(userCards.removedAt));
    expect(live.map((r) => r.id)).toEqual(expect.arrayContaining([mine, bound, theirs]));
  });

  it('previews and runs "Dust extras" on plain copies beyond 9', async () => {
    const { c, userId } = await newPlayer(t.app);
    await give(userId, 'MOS-001', 11);
    await give(userId, 'MOS-001', 1, { variant: 'void', mintNumber: 900 });
    await give(userId, 'MOS-005', 9);
    const preview = DustExtrasPreviewSchema.parse((await c.get('/api/cards/dust-extras')).json());
    // 12 MOS-001 copies (one Void) → 3 plain extras; MOS-005 is exactly maxed.
    expect(preview.copies).toHaveLength(3);
    expect(preview.copies.every((x) => x.cardId === 'MOS-001' && x.variant === 'normal')).toBe(
      true,
    );
    expect(preview.dust).toBe(15);

    const run = DustResponseSchema.parse((await c.post('/api/cards/dust-extras')).json());
    expect(run).toMatchObject({ dusted: 3, dust: 15, wallet: { dust: 15 } });
    const second = DustResponseSchema.parse((await c.post('/api/cards/dust-extras')).json());
    expect(second.dusted).toBe(0);
  });
});
