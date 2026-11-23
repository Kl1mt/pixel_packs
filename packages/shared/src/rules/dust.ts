import type { Stars } from '../model/card.js';
import type { Rarity, Variant } from '../model/enums.js';

/** Stardust from dusting a ★1 Normal copy (GDD §9). */
export const DUST_BASE: Readonly<Record<Rarity, number>> = {
  common: 5,
  uncommon: 15,
  rare: 50,
  epic: 200,
  legendary: 800,
  mythic: 2500,
};
export const DUST_VARIANT_MULTIPLIER: Readonly<Record<Variant, number>> = {
  normal: 1,
  foil: 2,
  prismatic: 10,
  void: 25,
  glitch: 60,
};

/** Stardust cost to craft a Normal copy of a non-event card (GDD §9). */
export const CRAFT_COST: Readonly<Record<Rarity, number>> = {
  common: 40,
  uncommon: 100,
  rare: 400,
  epic: 1600,
  legendary: 4000,
  mythic: 12000,
};

/** ★1-equivalents of a copy (GDD §9): ★1 = 1 · ★2 = 3 · ★3 = 9. */
export function starEquivalents(stars: Stars): number {
  return stars === 1 ? 1 : stars === 2 ? 3 : 9;
}

/** A card is "maxed" at this many ★1-equivalents. */
export const MAX_EQUIVALENTS = 9;

/**
 * Stardust for dusting one copy: base × variant multiplier × ★1-equivalents, so fusing
 * never gains or loses dust value.
 */
export function dustValue(rarity: Rarity, variant: Variant, stars: Stars = 1): number {
  return DUST_BASE[rarity] * DUST_VARIANT_MULTIPLIER[variant] * starEquivalents(stars);
}

/** Dust refunded when an extra special copy is used up in a fusion (GDD §9). */
export function variantDustBonus(rarity: Rarity, variant: Variant): number {
  return DUST_BASE[rarity] * (DUST_VARIANT_MULTIPLIER[variant] - 1);
}
