import { eq } from 'drizzle-orm';
import {
  STARTER_CARDS,
  advanceStage,
  grantsStarterCards,
  type OnboardingStage,
  type OnboardingState,
} from '@pixel-packs/shared';
import { ledger, userCards, users } from '../db/schema.js';
import { liveCopies } from '../economy/collection.js';
import type { EconomyCtx } from '../economy/context.js';
import { lockWallet, type Tx } from '../economy/db.js';

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

/**
 * Moves the player forward to `to` (never back). The first time the player reaches
 * `starter` or `done` — skipping counts — the five account-bound starter cards (GDD §17)
 * are granted, in one transaction with a ledger entry each.
 */
export async function advanceOnboarding(
  ctx: EconomyCtx,
  userId: string,
  to: OnboardingStage,
): Promise<OnboardingState> {
  return ctx.db.transaction(async (tx) => {
    const now = ctx.now();
    // Serialises with the user's other economy actions (GDD §22).
    await lockWallet(tx, userId, now);
    const [user] = await tx
      .select({ stage: users.onboardingStage, starterCardsAt: users.starterCardsAt })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    if (!user) throw new Error(`no user ${userId}`);
    const stage = advanceStage(user.stage, to);
    const grant = grantsStarterCards(stage) && user.starterCardsAt === null;
    if (stage !== user.stage || grant) {
      await tx
        .update(users)
        .set({ onboardingStage: stage, ...(grant ? { starterCardsAt: now } : {}) })
        .where(eq(users.id, userId));
    }
    if (grant) {
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
    return stateOf(tx, userId);
  });
}
