import { and, eq, gt, like } from 'drizzle-orm';
import {
  STARTER_CARDS,
  checkAdvance,
  grantsStarterCards,
  type OnboardingStage,
  type OnboardingState,
} from '@pixel-packs/shared';
import { ledger, packInventory, userCards, users } from '../db/schema.js';
import { liveCopies } from '../economy/collection.js';
import type { EconomyCtx } from '../economy/context.js';
import { lockWallet, type Tx } from '../economy/db.js';
import { HttpError } from '../http/errors.js';

async function stateOf(tx: Tx | EconomyCtx['db'], userId: string): Promise<OnboardingState> {
  const [user] = await tx
    .select({
      stage: users.onboardingStage,
      step: users.onboardingStep,
      starterCardsAt: users.starterCardsAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new Error(`no user ${userId}`);
  const starterCards =
    user.starterCardsAt === null
      ? null
      : await liveCopies(tx, userId, eq(userCards.source, 'starter'));
  return { stage: user.stage, scriptedPacksOpened: user.step, starterCards };
}

/** `GET /api/onboarding`. */
export function onboardingState(ctx: EconomyCtx, userId: string): Promise<OnboardingState> {
  return stateOf(ctx.db, userId);
}

/** Realm packs the player still owns (the satchel the scripted step is about). */
async function realmPacksOwned(tx: Tx, userId: string): Promise<number> {
  const rows = await tx
    .select({ count: packInventory.count })
    .from(packInventory)
    .where(
      and(
        eq(packInventory.userId, userId),
        gt(packInventory.count, 0),
        like(packInventory.packTypeId, 'realm:%'),
      ),
    );
  return rows.reduce((n, r) => n + r.count, 0);
}

const REFUSED = {
  skip: 'Onboarding cannot be skipped. Finish this step first.',
  packsFirst: 'Open both scripted packs first.',
} as const;

/**
 * Moves the player to the next stage `to` (GDD §17). Onboarding is mandatory (T22): a
 * jump over a stage, or leaving the packs before both scripted packs are open, is a
 * `409 onboardingOrder`; the current or an earlier stage is a no-op. The first time the
 * player reaches `starter`, the five account-bound starter cards are granted in the same
 * transaction, with a ledger entry each.
 */
export async function advanceOnboarding(
  ctx: EconomyCtx,
  userId: string,
  to: OnboardingStage,
): Promise<OnboardingState> {
  return ctx.db.transaction(async (tx) => {
    // Serialises with the user's other economy actions (GDD §22).
    await lockWallet(tx, userId, ctx.now());
    const [user] = await tx
      .select({ stage: users.onboardingStage, step: users.onboardingStep })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    if (!user) throw new Error(`no user ${userId}`);
    const check = checkAdvance(user.stage, to, {
      scriptedPacksOpened: user.step,
      realmPacksOwned: user.stage === 'packs' ? await realmPacksOwned(tx, userId) : 0,
    });
    if (check === 'skip' || check === 'packsFirst')
      throw new HttpError(409, 'onboardingOrder', REFUSED[check]);
    if (check === 'ok') await moveTo(ctx, tx, userId, to);
    return stateOf(tx, userId);
  });
}

/**
 * Sets the stage and grants the starter cards the first time a granting stage is reached.
 * Used by the player's own advance and by the dev-only `completeOnboarding`.
 */
export async function moveTo(
  ctx: EconomyCtx,
  tx: Tx,
  userId: string,
  stage: OnboardingStage,
): Promise<void> {
  const now = ctx.now();
  const [user] = await tx
    .select({ starterCardsAt: users.starterCardsAt })
    .from(users)
    .where(eq(users.id, userId));
  const grant = grantsStarterCards(stage) && user?.starterCardsAt === null;
  await tx
    .update(users)
    .set({ onboardingStage: stage, ...(grant ? { starterCardsAt: now } : {}) })
    .where(eq(users.id, userId));
  if (!grant) return;
  // Distinct acquiredAt per copy keeps the caravan order when listed oldest first.
  const rows = await tx
    .insert(userCards)
    .values(
      STARTER_CARDS.map((cardId, i) => ({
        userId,
        cardId,
        variant: 'normal' as const,
        source: 'starter' as const,
        accountBound: true,
        acquiredAt: new Date(now.getTime() + i),
      })),
    )
    .returning({ id: userCards.id, cardId: userCards.cardId });
  await tx.insert(ledger).values(
    rows.map((r) => ({
      userId,
      userCardId: r.id,
      reason: 'starterCards',
      meta: { cardId: r.cardId },
    })),
  );
}

/**
 * Test and dev only (`POST /api/dev/onboarding/complete`, never registered in production):
 * finishes onboarding at once, starter cards included, so specs can start at Home.
 */
export async function completeOnboarding(
  ctx: EconomyCtx,
  userId: string,
): Promise<OnboardingState> {
  return ctx.db.transaction(async (tx) => {
    await lockWallet(tx, userId, ctx.now());
    await moveTo(ctx, tx, userId, 'done');
    return stateOf(tx, userId);
  });
}
