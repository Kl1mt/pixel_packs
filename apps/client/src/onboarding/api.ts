import {
  OnboardingStateSchema,
  type OnboardingStage,
  type OnboardingState,
} from '@pixel-packs/shared';
import { http, type Http } from '../http.js';

/** Typed calls for the T16 onboarding endpoints (docs/api.md). */
export function createOnboardingApi(h: Http = http) {
  return {
    state: (): Promise<OnboardingState> => h.get('/api/onboarding', OnboardingStateSchema),
    advance: async (stage: OnboardingStage): Promise<OnboardingState> => {
      const s = await h.post('/api/onboarding/advance', { stage }, OnboardingStateSchema);
      if (!s) throw new Error('Empty answer from the server');
      return s;
    },
  };
}

export type OnboardingApi = ReturnType<typeof createOnboardingApi>;
export const onboardingApi = createOnboardingApi();
