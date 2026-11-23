import {
  CollectionResponseSchema,
  DustExtrasPreviewSchema,
  DustResponseSchema,
  PullHistoryResponseSchema,
  type DustExtrasPreview,
  type DustResponse,
  type CollectionCopy,
  type PullHistoryFilter,
  type PullHistoryResponse,
} from '@pixel-packs/shared';
import { http, type Http } from '../http.js';
import { publishWallet } from '../shell/useWallet.js';

/** Binder, inspect and history calls (T15). Dusting also refreshes the top-bar wallet. */
export function createBinderApi(h: Http = http) {
  const afterDust = (r: DustResponse | undefined): DustResponse => {
    if (!r) throw new Error('empty dust response');
    publishWallet(r.wallet);
    return r;
  };
  return {
    collection: async (): Promise<CollectionCopy[]> =>
      (await h.get('/api/cards', CollectionResponseSchema)).copies,
    dust: async (userCardIds: readonly string[]): Promise<DustResponse> =>
      afterDust(await h.post('/api/cards/dust', { userCardIds }, DustResponseSchema)),
    dustExtrasPreview: (): Promise<DustExtrasPreview> =>
      h.get('/api/cards/dust-extras', DustExtrasPreviewSchema),
    dustExtras: async (): Promise<DustResponse> =>
      afterDust(await h.post('/api/cards/dust-extras', undefined, DustResponseSchema)),
    history: (
      filter: PullHistoryFilter,
      cursor: string | null,
      limit = 20,
    ): Promise<PullHistoryResponse> => {
      const q = new URLSearchParams({ limit: String(limit) });
      if (cursor) q.set('cursor', cursor);
      for (const [k, v] of Object.entries(filter)) if (v) q.set(k, v);
      return h.get(`/api/packs/history?${q.toString()}`, PullHistoryResponseSchema);
    },
  };
}

export type BinderApi = ReturnType<typeof createBinderApi>;
export const binderApi = createBinderApi();
