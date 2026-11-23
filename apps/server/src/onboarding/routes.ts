import type { FastifyInstance } from 'fastify';
import { AdvanceOnboardingRequestSchema, type OnboardingState } from '@pixel-packs/shared';
import { requireAuth } from '../auth/plugin.js';
import type { EconomyCtx } from '../economy/context.js';
import { advanceOnboarding, onboardingState } from './service.js';

/** Onboarding (GDD §17, T16): where the player is, and moving on (which grants the starter cards). */
export function registerOnboardingRoutes(app: FastifyInstance, ctx: EconomyCtx): void {
  app.get('/api/onboarding', (req): Promise<OnboardingState> =>
    onboardingState(ctx, requireAuth(req).user.id),
  );

  app.post(
    '/api/onboarding/advance',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    (req): Promise<OnboardingState> => {
      const { user } = requireAuth(req);
      const { stage } = AdvanceOnboardingRequestSchema.parse(req.body);
      return advanceOnboarding(ctx, user.id, stage);
    },
  );
}
