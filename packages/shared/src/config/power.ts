import type { Rarity } from '../model/enums.js';

/**
 * Power budget per rarity (GDD §4): base ATK + HP of a ★1 card.
 * M1 cards spend exactly this on stats; ability costs are tuned in M4 (GDD §29).
 */
export const POWER_BUDGET: Readonly<Record<Rarity, number>> = {
  common: 8,
  uncommon: 9,
  rare: 10,
  epic: 11,
  legendary: 12,
  mythic: 13,
};
