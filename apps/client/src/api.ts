import { HealthResponseSchema, type HealthResponse } from '@pixel-packs/shared';

/** Fetches `/api/health` (proxied to the server in dev) and validates it. */
export async function fetchHealth(fetchFn: typeof fetch = fetch): Promise<HealthResponse> {
  const res = await fetchFn('/api/health');
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  return HealthResponseSchema.parse(await res.json());
}
