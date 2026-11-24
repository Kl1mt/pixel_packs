import type { FastifyInstance } from 'fastify';
import {
  DevGrantRequestSchema,
  DevOddsOverrideRequestSchema,
  type EconomyState,
} from '@pixel-packs/shared';
import { grantCurrency, grantPacks, setOddsOverride } from '../admin/index.js';
import { requireAuth } from '../auth/plugin.js';
import type { EconomyCtx } from '../economy/context.js';
import { economyState } from '../economy/state.js';
import { completeOnboarding } from '../onboarding/service.js';

/**
 * Dev-only HTTP routes for the `/debug` page (T12), on top of the admin helpers.
 * Registered only when dev overrides are allowed, so production has no `/api/dev`.
 * They act on the logged-in player only.
 */
export function registerDevRoutes(app: FastifyInstance, ctx: EconomyCtx): void {
  app.post('/api/dev/odds-override', async (req, reply) => {
    const { user } = requireAuth(req);
    const o = DevOddsOverrideRequestSchema.parse(req.body);
    await setOddsOverride(ctx.db, user.id, {
      packs: o.packs,
      ...(o.rarity ? { rarity: o.rarity } : {}),
      ...(o.variant ? { variant: o.variant } : {}),
    });
    return reply.status(204).send();
  });

  // Specs start at Home through this, since the player-facing flow cannot be skipped (T22).
  app.post('/api/dev/onboarding/complete', (req) =>
    completeOnboarding(ctx, requireAuth(req).user.id),
  );

  app.post('/api/dev/grant', async (req): Promise<EconomyState> => {
    const { user } = requireAuth(req);
    const g = DevGrantRequestSchema.parse(req.body);
    if (g.gold) await grantCurrency(ctx.db, user.id, 'gold', g.gold, 'dev');
    if (g.gems) await grantCurrency(ctx.db, user.id, 'gems', g.gems, 'dev');
    if (g.packs) await grantPacks(ctx.db, user.id, g.packs.packTypeId, g.packs.count, 'dev');
    return economyState(ctx, user.id);
  });
}
