import {
  DustExtrasPreviewSchema,
  DustResponseSchema,
  EconomyStateSchema,
  OddsResponseSchema,
  OpenPackResponseSchema,
  PendingOpeningResponseSchema,
  type DevGrantRequest,
  type DevOddsOverrideRequest,
  type DustExtrasPreview,
  type DustResponse,
  type EconomyState,
  type OddsResponse,
  type PackOpening,
  type PackTypeId,
  type Realm,
} from '@pixel-packs/shared';
import { http, type Http } from '../http.js';

/** A fresh idempotency key per click; the caller reuses it when retrying (docs/api.md). */
export const newIdempotencyKey = (): string => crypto.randomUUID();

const must = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error('Empty answer from the server');
  return v;
};

/** Typed calls for the T10 economy endpoints (Zod-checked answers). */
export function createEconomyApi(h: Http = http) {
  return {
    state: (): Promise<EconomyState> => h.get('/api/economy', EconomyStateSchema),
    odds: (): Promise<OddsResponse> => h.get('/api/packs/odds', OddsResponseSchema),
    buy: async (packTypeId: PackTypeId, idempotencyKey: string): Promise<EconomyState> =>
      must(await h.post('/api/packs/buy', { packTypeId, idempotencyKey }, EconomyStateSchema)),
    claimCalendar: async (): Promise<EconomyState> =>
      must(await h.post('/api/rewards/calendar', undefined, EconomyStateSchema)),
    claimFreePack: async (realm: Realm): Promise<EconomyState> =>
      must(await h.post('/api/rewards/free-pack', { realm }, EconomyStateSchema)),
    open: async (packTypeId: PackTypeId, idempotencyKey: string): Promise<PackOpening> =>
      must(await h.post('/api/packs/open', { packTypeId, idempotencyKey }, OpenPackResponseSchema))
        .opening,
    pending: async (): Promise<PackOpening | null> =>
      (await h.get('/api/packs/openings/pending', PendingOpeningResponseSchema)).opening,
    markRevealed: async (id: string): Promise<void> => {
      await h.post(`/api/packs/openings/${id}/revealed`);
    },
    dustExtrasPreview: (): Promise<DustExtrasPreview> =>
      h.get('/api/cards/dust-extras', DustExtrasPreviewSchema),
    dustExtras: async (): Promise<DustResponse> =>
      must(await h.post('/api/cards/dust-extras', undefined, DustResponseSchema)),
    /** Dev-only (`/debug`): 404 on a production server. */
    devOddsOverride: async (o: DevOddsOverrideRequest): Promise<void> => {
      await h.post('/api/dev/odds-override', o);
    },
    devGrant: async (g: DevGrantRequest): Promise<EconomyState> =>
      must(await h.post('/api/dev/grant', g, EconomyStateSchema)),
  };
}

export type EconomyApi = ReturnType<typeof createEconomyApi>;
export const economyApi = createEconomyApi();
