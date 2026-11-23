import { useEffect, useState } from 'react';
import type { AuthProvidersResponse } from '@pixel-packs/shared';
import { authApi } from './api.js';

let cached: Promise<AuthProvidersResponse> | null = null;

/**
 * Which optional login providers the server has credentials for. Until it answers
 * (or if it fails) everything optional stays hidden, so no broken button ever shows.
 */
export function useProviders(): AuthProvidersResponse {
  const [providers, setProviders] = useState<AuthProvidersResponse>({ discord: false });
  useEffect(() => {
    let live = true;
    cached ??= authApi.providers().catch(() => {
      cached = null;
      return { discord: false };
    });
    void cached.then((p) => {
      if (live) setProviders(p);
    });
    return () => {
      live = false;
    };
  }, []);
  return providers;
}
