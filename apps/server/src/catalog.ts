import type { Card } from '@pixel-packs/shared';

/**
 * The catalog synced into `cards` on start. Empty until the real set exists:
 * T10 points this at the T03 catalog from `packages/shared`.
 */
export const SERVER_CATALOG: readonly Card[] = [];
