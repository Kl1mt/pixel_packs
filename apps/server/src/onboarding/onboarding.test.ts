import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CollectionResponseSchema,
  OnboardingStateSchema,
  STARTER_CARDS,
} from '@pixel-packs/shared';
import { eq } from 'drizzle-orm';
import { resetOnboarding } from '../admin/index.js';
import { ledger } from '../db/schema.js';
import { createTestApp, key, newPlayer, type Client, type TestApp } from '../testing/harness.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const state = async (c: Client) =>
  OnboardingStateSchema.parse((await c.get('/api/onboarding')).json());
const advance = async (c: Client, stage: string) => {
  const res = await c.post('/api/onboarding/advance', { stage });
  expect(res.statusCode).toBe(200);
  return OnboardingStateSchema.parse(res.json());
};

describe('onboarding', () => {
  it('starts at the courier and moves forward only', async () => {
    const { c } = await newPlayer(t.app);
    expect(await state(c)).toEqual({
      stage: 'courier',
      scriptedPacksOpened: 0,
      starterCards: null,
    });
    expect((await advance(c, 'tour')).stage).toBe('tour');
    expect((await advance(c, 'packs')).stage).toBe('tour');
    expect((await state(c)).starterCards).toBeNull();
  });

  it('counts scripted packs opened', async () => {
    const { c } = await newPlayer(t.app);
    await c.post('/api/packs/open', { packTypeId: 'realm:mossgrove', idempotencyKey: key() });
    expect((await state(c)).scriptedPacksOpened).toBe(1);
  });

  it('grants the five account-bound starter cards once, in caravan order', async () => {
    const { c, userId } = await newPlayer(t.app);
    const s = await advance(c, 'starter');
    expect(s.starterCards?.map((x) => x.cardId)).toEqual([...STARTER_CARDS]);
    expect(s.starterCards?.every((x) => x.accountBound && x.source === 'starter')).toBe(true);
    expect(s.starterCards?.every((x) => x.variant === 'normal' && x.edition === null)).toBe(true);

    // Moving on, repeating, or a reset onboarding never grants them again.
    await advance(c, 'done');
    await advance(c, 'starter');
    await resetOnboarding(t.db.db, userId);
    expect((await state(c)).stage).toBe('courier');
    await advance(c, 'done');
    const { copies } = CollectionResponseSchema.parse((await c.get('/api/cards')).json());
    expect(copies.filter((x) => x.source === 'starter')).toHaveLength(5);
    const rows = await t.db.db.select().from(ledger).where(eq(ledger.userId, userId));
    expect(rows.filter((r) => r.reason === 'starterCards')).toHaveLength(5);
  });

  it('skipping straight to done still grants them; they cannot be dusted', async () => {
    const { c } = await newPlayer(t.app);
    const s = await advance(c, 'done');
    expect(s.starterCards).toHaveLength(5);
    const first = s.starterCards?.[0];
    const res = await c.post('/api/cards/dust', { userCardIds: [first?.userCardId] });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'cannotDust' } });
  });

  it('grants once under concurrent advances', async () => {
    const { c } = await newPlayer(t.app);
    await Promise.all([advance(c, 'starter'), advance(c, 'done'), advance(c, 'starter')]);
    expect((await state(c)).starterCards).toHaveLength(5);
  });

  it('rejects unknown stages and guests', async () => {
    const { c } = await newPlayer(t.app);
    expect((await c.post('/api/onboarding/advance', { stage: 'nope' })).statusCode).toBe(400);
    const guest = await newPlayer(t.app);
    await guest.c.post('/api/auth/logout');
    expect((await guest.c.get('/api/onboarding')).statusCode).toBe(401);
  });
});
