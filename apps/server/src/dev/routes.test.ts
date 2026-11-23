import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EconomyStateSchema, OpenPackResponseSchema } from '@pixel-packs/shared';
import { createTestApp, key, newPlayer, type TestApp } from '../testing/harness.js';

let t: TestApp;
let prod: TestApp;
beforeAll(async () => {
  [t, prod] = await Promise.all([createTestApp(), createTestApp({ allowDevOverrides: false })]);
});
afterAll(async () => {
  await Promise.all([t.close(), prod.close()]);
});

const open = async (c: Awaited<ReturnType<typeof newPlayer>>['c']) => {
  const res = await c.post('/api/packs/open', {
    packTypeId: 'realm:mossgrove',
    idempotencyKey: key(),
  });
  return OpenPackResponseSchema.parse(res.json()).opening;
};

describe('dev routes', () => {
  it('grants gold, gems and packs to the logged-in player', async () => {
    const { c } = await newPlayer(t.app);
    const res = await c.post('/api/dev/grant', {
      gold: 500,
      gems: 300,
      packs: { packTypeId: 'realm:mossgrove', count: 3 },
    });
    expect(res.statusCode).toBe(200);
    const s = EconomyStateSchema.parse(res.json());
    expect(s.wallet).toMatchObject({ gold: 500, gems: 300 });
    // The starter satchel already holds one Mossgrove pack.
    expect(s.packs.find((p) => p.packTypeId === 'realm:mossgrove')?.count).toBe(4);
    expect((await c.post('/api/dev/grant', {})).statusCode).toBe(400);
  });

  it('forces the featured slot of the next packs, after the scripted ones', async () => {
    const { c } = await newPlayer(t.app);
    await c.post('/api/dev/grant', { packs: { packTypeId: 'realm:mossgrove', count: 3 } });
    // The first two realm packs of an account are the scripted onboarding packs.
    await open(c);
    await open(c);
    const set = await c.post('/api/dev/odds-override', {
      packs: 1,
      rarity: 'legendary',
      variant: 'void',
    });
    expect(set.statusCode).toBe(204);
    const forced = await open(c);
    const featured = forced.cards.find((card) => card.featured);
    expect(featured).toMatchObject({ rarity: 'legendary', variant: 'void' });
    expect(featured?.mintNumber).toBeGreaterThan(0);
    expect((await c.post('/api/dev/odds-override', { packs: 0 })).statusCode).toBe(204);
  });

  it('needs a session and does not exist without dev overrides', async () => {
    const { c } = await newPlayer(prod.app);
    expect((await c.post('/api/dev/grant', { gold: 1 })).statusCode).toBe(404);
    expect((await c.post('/api/dev/odds-override', { packs: 1 })).statusCode).toBe(404);
    const { c: guest } = await newPlayer(t.app);
    await guest.post('/api/auth/logout');
    expect((await guest.post('/api/dev/grant', { gold: 1 })).statusCode).toBe(401);
  });
});
