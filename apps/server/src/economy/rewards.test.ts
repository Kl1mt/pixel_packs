import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { EconomyStateSchema, FREE_PACK_INTERVAL_MS, type EconomyState } from '@pixel-packs/shared';
import { grantCurrency } from '../admin/index.js';
import { ledger } from '../db/schema.js';
import { createTestApp, key, newPlayer, type Client, type TestApp } from '../testing/harness.js';

let t: TestApp;
let clock = new Date('2026-11-23T10:00:00.000Z');
beforeAll(async () => {
  t = await createTestApp({ now: () => clock });
});
afterAll(() => t.close());
beforeEach(() => {
  clock = new Date('2026-11-23T10:00:00.000Z');
});

const later = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};
async function state(c: Client): Promise<EconomyState> {
  const res = await c.get('/api/economy');
  expect(res.statusCode).toBe(200);
  return EconomyStateSchema.parse(res.json());
}

describe('new account', () => {
  it('gets the starter satchel, an empty wallet and one free pack ready', async () => {
    const { c } = await newPlayer(t.app);
    const s = await state(c);
    expect(s.wallet).toEqual({ gold: 0, dust: 0, gems: 0 });
    expect(s.packs).toEqual([
      { packTypeId: 'realm:mossgrove', count: 1 },
      { packTypeId: 'realm:starhollow', count: 1 },
    ]);
    expect(s.freePack).toEqual({
      stored: 1,
      max: 2,
      nextAt: new Date(clock.getTime() + FREE_PACK_INTERVAL_MS).toISOString(),
    });
    expect(s.calendar).toMatchObject({ day: 1, claimedToday: false });
    expect(s.pity.map((p) => p.group)).toEqual(['realm', 'mythic']);
    expect(s.pendingOpeningId).toBeNull();
  });

  it('requires a session', async () => {
    const { c } = await newPlayer(t.app);
    await c.post('/api/auth/logout');
    expect((await c.get('/api/economy')).statusCode).toBe(401);
  });
});

describe('free packs', () => {
  it('claims a stored pack as the chosen realm and refuses when none is ready', async () => {
    const { c } = await newPlayer(t.app);
    const ok = await c.post('/api/rewards/free-pack', { realm: 'starhollow' });
    expect(ok.statusCode).toBe(200);
    const s = EconomyStateSchema.parse(ok.json());
    expect(s.packs).toContainEqual({ packTypeId: 'realm:starhollow', count: 2 });
    expect(s.freePack.stored).toBe(0);

    const none = await c.post('/api/rewards/free-pack', { realm: 'starhollow' });
    expect(none.statusCode).toBe(409);
    expect(none.json()).toMatchObject({ error: { code: 'notReady' } });

    later(FREE_PACK_INTERVAL_MS);
    expect((await c.post('/api/rewards/free-pack', { realm: 'mossgrove' })).statusCode).toBe(200);
  });

  it('stores at most two', async () => {
    const { c } = await newPlayer(t.app);
    later(5 * FREE_PACK_INTERVAL_MS);
    expect((await state(c)).freePack).toMatchObject({ stored: 2, nextAt: null });
    for (let i = 0; i < 2; i++) {
      expect((await c.post('/api/rewards/free-pack', { realm: 'mossgrove' })).statusCode).toBe(200);
    }
    expect((await c.post('/api/rewards/free-pack', { realm: 'mossgrove' })).statusCode).toBe(409);
  });

  it('rejects realms that are not open', async () => {
    const { c } = await newPlayer(t.app);
    const res = await c.post('/api/rewards/free-pack', { realm: 'tidepool' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'packDisabled' } });
  });
});

describe('daily calendar', () => {
  it('pays once per UTC day and walks through the 7 days', async () => {
    const { c, userId } = await newPlayer(t.app);
    const first = await c.post('/api/rewards/calendar');
    expect(first.statusCode).toBe(200);
    expect(EconomyStateSchema.parse(first.json())).toMatchObject({
      wallet: { gold: 40 },
      calendar: { day: 1, claimedToday: true },
    });
    const again = await c.post('/api/rewards/calendar');
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'alreadyClaimed' } });

    for (let day = 2; day <= 8; day++) {
      clock = new Date(`2026-11-${22 + day}T00:00:05.000Z`);
      expect((await c.post('/api/rewards/calendar')).statusCode).toBe(200);
    }
    const s = await state(c);
    // Days 1–7 (350 gold, 150 dust), then day 1 again (40 gold).
    expect(s.wallet).toEqual({ gold: 390, dust: 150, gems: 0 });
    expect(s.calendar).toMatchObject({ day: 1, claimedToday: true });
    const entries = await t.db.db
      .select()
      .from(ledger)
      .where(and(eq(ledger.userId, userId), eq(ledger.reason, 'calendar')));
    expect(entries).toHaveLength(8); // one balance change per claim
  });
});

describe('buying packs', () => {
  it('debits gold, adds packs, and replays a repeated key', async () => {
    const { c, userId } = await newPlayer(t.app);
    await grantCurrency(t.db.db, userId, 'gold', 250);
    const k = key();
    const buy = () =>
      c.post('/api/packs/buy', { packTypeId: 'realm:mossgrove', quantity: 2, idempotencyKey: k });
    const res = await buy();
    expect(res.statusCode).toBe(200);
    const s = EconomyStateSchema.parse(res.json());
    expect(s.wallet.gold).toBe(50);
    expect(s.packs).toContainEqual({ packTypeId: 'realm:mossgrove', count: 3 });
    const replay = EconomyStateSchema.parse((await buy()).json());
    expect(replay.wallet.gold).toBe(50);

    const conflict = await c.post('/api/packs/buy', {
      packTypeId: 'realm:starhollow',
      quantity: 2,
      idempotencyKey: k,
    });
    expect(conflict.json()).toMatchObject({ error: { code: 'idempotencyConflict' } });
  });

  it('refuses without enough funds and for disabled packs', async () => {
    const { c } = await newPlayer(t.app);
    const poor = await c.post('/api/packs/buy', { packTypeId: 'mythic', idempotencyKey: key() });
    expect(poor.statusCode).toBe(409);
    expect(poor.json()).toMatchObject({ error: { code: 'insufficientFunds' } });
    const closed = await c.post('/api/packs/buy', {
      packTypeId: 'realm:skyloft',
      idempotencyKey: key(),
    });
    expect(closed.json()).toMatchObject({ error: { code: 'packDisabled' } });
    const bad = await c.post('/api/packs/buy', {
      packTypeId: 'realm:nowhere',
      idempotencyKey: key(),
    });
    expect(bad.statusCode).toBe(400);
  });

  it('buys the Mythic pack with gems', async () => {
    const { c, userId } = await newPlayer(t.app);
    await grantCurrency(t.db.db, userId, 'gems', 300);
    const res = await c.post('/api/packs/buy', { packTypeId: 'mythic', idempotencyKey: key() });
    const s = EconomyStateSchema.parse(res.json());
    expect(s.wallet.gems).toBe(0);
    expect(s.packs).toContainEqual({ packTypeId: 'mythic', count: 1 });
  });
});
