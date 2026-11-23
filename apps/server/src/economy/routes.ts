import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BuyPacksRequestSchema,
  ClaimFreePackRequestSchema,
  DustRequestSchema,
  OpenPackRequestSchema,
  PullHistoryQuerySchema,
  type DustExtrasPreview,
  type DustResponse,
  type EconomyState,
  type OddsResponse,
  type OpenPackResponse,
  type PullHistoryResponse,
} from '@pixel-packs/shared';
import { requireAuth } from '../auth/plugin.js';
import type { EconomyCtx } from './context.js';
import { dustCopies, dustExtras, previewDustExtras } from './dust.js';
import { oddsResponse } from './odds.js';
import { markRevealed, openPack, pendingOpening, pullHistory } from './opening.js';
import { buyPacks, claimCalendar, claimFreePack, economyState } from './state.js';

/** Per-IP limits (GDD §22). */
const LIMITS = {
  open: { max: 60, timeWindow: '1 minute' },
  mutate: { max: 60, timeWindow: '1 minute' },
} as const;
const limit = (l: (typeof LIMITS)[keyof typeof LIMITS]) => ({ config: { rateLimit: l } });

const OpeningParamsSchema = z.object({ id: z.uuid() });

export function registerEconomyRoutes(app: FastifyInstance, ctx: EconomyCtx): void {
  const odds = oddsResponse();
  app.get('/api/packs/odds', (): OddsResponse => odds);

  app.get('/api/economy', (req): Promise<EconomyState> =>
    economyState(ctx, requireAuth(req).user.id),
  );

  app.post('/api/rewards/free-pack', limit(LIMITS.mutate), async (req) => {
    const { user } = requireAuth(req);
    const { realm } = ClaimFreePackRequestSchema.parse(req.body);
    await claimFreePack(ctx, user.id, realm);
    return economyState(ctx, user.id);
  });

  app.post('/api/rewards/calendar', limit(LIMITS.mutate), async (req) => {
    const { user } = requireAuth(req);
    await claimCalendar(ctx, user.id);
    return economyState(ctx, user.id);
  });

  app.post('/api/packs/buy', limit(LIMITS.mutate), async (req) => {
    const { user } = requireAuth(req);
    const input = BuyPacksRequestSchema.parse(req.body);
    await buyPacks(ctx, user.id, input);
    return economyState(ctx, user.id);
  });

  app.post('/api/packs/open', limit(LIMITS.open), async (req, reply): Promise<OpenPackResponse> => {
    const { user } = requireAuth(req);
    const result = await openPack(ctx, user.id, OpenPackRequestSchema.parse(req.body));
    reply.status(result.replayed ? 200 : 201);
    return result;
  });

  app.get('/api/packs/openings/pending', async (req) => ({
    opening: await pendingOpening(ctx, requireAuth(req).user.id),
  }));

  app.post('/api/packs/openings/:id/revealed', limit(LIMITS.mutate), async (req, reply) => {
    const { user } = requireAuth(req);
    await markRevealed(ctx, user.id, OpeningParamsSchema.parse(req.params).id);
    return reply.status(204).send();
  });

  app.get('/api/packs/history', (req): Promise<PullHistoryResponse> => {
    const { user } = requireAuth(req);
    const { limit: n, cursor } = PullHistoryQuerySchema.parse(req.query);
    return pullHistory(ctx, user.id, n, cursor);
  });

  app.post('/api/cards/dust', limit(LIMITS.mutate), (req): Promise<DustResponse> => {
    const { user } = requireAuth(req);
    return dustCopies(ctx, user.id, DustRequestSchema.parse(req.body).userCardIds);
  });

  app.get('/api/cards/dust-extras', (req): Promise<DustExtrasPreview> =>
    previewDustExtras(ctx, requireAuth(req).user.id),
  );

  app.post('/api/cards/dust-extras', limit(LIMITS.mutate), (req): Promise<DustResponse> =>
    dustExtras(ctx, requireAuth(req).user.id),
  );
}
