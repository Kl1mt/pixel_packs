import { z } from 'zod';
import { CollectionCopySchema } from './collection.js';

/**
 * Onboarding stages (GDD §17), in order. `courier` = the moth courier's three lines,
 * `packs` = the two scripted packs, `tour` = the binder tour, `starter` = the five
 * account-bound starter cards, `done` = Home. Stages only move forward.
 */
export const ONBOARDING_STAGES = ['courier', 'packs', 'tour', 'starter', 'done'] as const;
export const OnboardingStageSchema = z.enum(ONBOARDING_STAGES);
export type OnboardingStage = z.infer<typeof OnboardingStageSchema>;

/** `GET /api/onboarding` and the answer of `POST /api/onboarding/advance`. */
export const OnboardingStateSchema = z.object({
  stage: OnboardingStageSchema,
  /** Scripted packs opened so far (0–2); the next realm pack opened is scripted while < 2. */
  scriptedPacksOpened: z.int().min(0),
  /** The starter copies once granted (from the `starter` stage on), else null. */
  starterCards: z.array(CollectionCopySchema).nullable(),
});
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

/**
 * Moves to `stage`: only the next stage, and out of `packs` only after both scripted packs
 * (T22, onboarding is mandatory). The current or an earlier stage is a no-op. Reaching
 * `starter` or `done` grants the starter cards once.
 */
export const AdvanceOnboardingRequestSchema = z.object({ stage: OnboardingStageSchema });
export type AdvanceOnboardingRequest = z.infer<typeof AdvanceOnboardingRequestSchema>;
