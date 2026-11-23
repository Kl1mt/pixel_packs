import type { PackRoll, PackType, PityCounters } from '../model/pack.js';
import type { Rng } from '../rng/rng.js';
import type { CatalogIndex } from './catalog.js';
import { rollPackInternal, type FeaturedScript } from './packRoll.js';

/**
 * Scripted onboarding packs (GDD §17): pack 1 forces an Epic featured card, pack 2 a
 * Foil featured card (its rarity rolls normally). Only the forced trait is scripted.
 */
export const ONBOARDING_SCRIPTS: readonly FeaturedScript[] = [
  { rarity: 'epic' },
  { variant: 'foil' },
];

/**
 * Rolls onboarding pack `step` (0-based) as a realm pack of `realm`.
 * Scripted packs don't count towards pity: the returned counters equal the input.
 */
export function rollScriptedPack(
  step: number,
  pack: Extract<PackType, { kind: 'realm' }>,
  pity: PityCounters,
  index: CatalogIndex,
  rng: Rng,
): PackRoll {
  const script = ONBOARDING_SCRIPTS[step];
  if (!script) throw new RangeError(`no onboarding script for step ${step}`);
  return rollPackInternal(pack, pity, index, rng, script);
}
