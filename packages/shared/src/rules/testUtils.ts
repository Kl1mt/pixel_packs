import { buildPlaceholderCatalog } from '../testing/placeholderCatalog.js';
import type { Rng } from '../rng/rng.js';
import { buildCatalogIndex } from './catalog.js';

export const M1_INDEX = buildCatalogIndex(buildPlaceholderCatalog(['mossgrove', 'starhollow']));

/** Always draws 0: lowest rarity, own realm, first card, Normal — the unluckiest player. */
export const ZERO_RNG: Rng = { int: () => 0 };

/** Half-width of a ~5σ interval for a count with mean `n·p`. */
export function tolerance(n: number, p: number): number {
  return 5 * Math.sqrt(n * p * (1 - p)) + 1;
}
