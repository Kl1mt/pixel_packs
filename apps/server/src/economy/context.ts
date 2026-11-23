import type { CatalogIndex, Rng } from '@pixel-packs/shared';
import type { Db } from '../db/client.js';

/** What the economy code needs; tests inject the clock and the RNG. */
export interface EconomyCtx {
  db: Db;
  now: () => Date;
  /** The pack RNG: `createCryptoRng()` outside tests (GDD §5). */
  rng: Rng;
  index: CatalogIndex;
  /** Honour `dev_odds_overrides` (never in production). */
  allowDevOverrides: boolean;
}
