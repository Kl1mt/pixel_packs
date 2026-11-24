import { ONBOARDING_STAGES, type OnboardingStage } from '../api/onboarding.js';

/**
 * The five account-bound starter cards (GDD §17 step 4), in caravan order front → back
 * (GDD §10): a shielded tank, a wisp that buffs the next card when it faints, a thorny
 * hoglet, a moth that weakens the enemy front, and a healer in support at the back.
 */
export const STARTER_CARDS: readonly string[] = [
  'MOS-001',
  'STA-002',
  'MOS-003',
  'STA-001',
  'MOS-002',
];

/** Stages from `courier` to `done` as 0–4. */
export const stageIndex = (stage: OnboardingStage): number => ONBOARDING_STAGES.indexOf(stage);

/** Scripted packs a player opens in the `packs` stage before the binder tour. */
export const SCRIPTED_PACKS = 2;

/** What the player has done so far, as far as the stage order cares. */
export interface OnboardingProgress {
  scriptedPacksOpened: number;
  /** Realm packs still in the satchel (if none are left, the pack step cannot block). */
  realmPacksOwned: number;
}

/**
 * Onboarding is mandatory (GDD §17, T22): a move is `ok` only to the very next stage,
 * and out of `packs` only once both scripted packs are open (or no realm pack is left).
 * A move to the current or an earlier stage is a `noop` (a retried request). Anything
 * else is refused: `skip` jumps over a stage, `packsFirst` leaves packs unopened.
 */
export type AdvanceCheck = 'ok' | 'noop' | 'skip' | 'packsFirst';

export function checkAdvance(
  current: OnboardingStage,
  to: OnboardingStage,
  progress: OnboardingProgress,
): AdvanceCheck {
  const from = stageIndex(current);
  const target = stageIndex(to);
  if (target <= from) return 'noop';
  if (target > from + 1) return 'skip';
  if (
    current === 'packs' &&
    progress.scriptedPacksOpened < SCRIPTED_PACKS &&
    progress.realmPacksOwned > 0
  )
    return 'packsFirst';
  return 'ok';
}

/** True once the player has reached a stage that hands out the starter cards. */
export const grantsStarterCards = (stage: OnboardingStage): boolean =>
  stageIndex(stage) >= stageIndex('starter');
