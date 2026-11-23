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

/** Forward-only move: the later of the two stages. */
export function advanceStage(current: OnboardingStage, to: OnboardingStage): OnboardingStage {
  return stageIndex(to) > stageIndex(current) ? to : current;
}

/** True once the player has reached a stage that hands out the starter cards. */
export const grantsStarterCards = (stage: OnboardingStage): boolean =>
  stageIndex(stage) >= stageIndex('starter');
