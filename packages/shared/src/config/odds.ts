/**
 * All pack odds and pity rules (GDD §5–§7). Shown in-game via the "?" on each pack.
 * Weights are integers so that rolls use `rng.int(total)` with no float drift.
 */
import type { Rarity, Realm, Variant } from '../model/enums.js';

/** Integer weights; the chance of a key is `weight / sum(weights)`. */
export type WeightTable<K extends string> = Readonly<Partial<Record<K, number>>>;

/** Rarity weights are per mille (1 = 0.1 %). */
export const RARITY_SCALE = 1000;

/** Slots 1–4 of every pack (GDD §5). */
export const BASE_SLOT_RARITY: WeightTable<Rarity> = {
  common: 700,
  uncommon: 220,
  rare: 60,
  epic: 16,
  legendary: 3,
  mythic: 1,
};

/** Featured slot 5 of a realm pack: always Uncommon or better. */
export const REALM_FEATURED_RARITY: WeightTable<Rarity> = {
  uncommon: 550,
  rare: 320,
  epic: 90,
  legendary: 32,
  mythic: 8,
};

/** Featured slot 5 of the Mythic pack (GDD §7). */
export const MYTHIC_PACK_FEATURED_RARITY: WeightTable<Rarity> = {
  epic: 750,
  legendary: 200,
  mythic: 50,
};

export const SLOTS_PER_PACK = 5;
export const FEATURED_SLOT = 5;

/** Variant weights are per 6000 (LCM of 12, 150, 400, 1500), so tripling stays exact. */
export const VARIANT_SCALE = 6000;
export const VARIANT_CHANCES: Readonly<Record<Exclude<Variant, 'normal'>, number>> = {
  foil: 500, // 1/12
  prismatic: 40, // 1/150
  void: 15, // 1/400
  glitch: 4, // 1/1500
};
export const MYTHIC_PACK_VARIANT_MULTIPLIER = 3;

/** Realm split of a realm pack: 80 % its own realm, 20 % any enabled realm (own included). */
export const REALM_PACK_OWN_REALM_PERCENT = 80;

/** Realms whose cards and packs are live. M1: Mossgrove and Starhollow. */
export const ENABLED_REALMS: readonly Realm[] = ['mossgrove', 'starhollow'];

/** Cards per realm and rarity in a set (GDD §4): 13 per realm. */
export const REALM_COMPOSITION: Readonly<Record<Rarity, number>> = {
  common: 4,
  uncommon: 3,
  rare: 2,
  epic: 2,
  legendary: 1,
  mythic: 1,
};

export interface PityRules {
  /** The featured slot of the Nth pack without a Legendary+ is Legendary+. */
  legendaryHardPity: number;
  /** From the Nth pack without a Mythic, the featured slot gains +step per mille per pack. */
  mythicSoftPityStart: number | null;
  mythicSoftPityStepPerMille: number;
  /** The featured slot of the Nth pack without a Mythic is Mythic. */
  mythicHardPity: number;
}

/** Pity groups (GDD §5): all realm packs share one counter set; the Mythic pack has its own. */
export const PITY_RULES: Readonly<Record<'realm' | 'mythic', PityRules>> = {
  realm: {
    legendaryHardPity: 40,
    mythicSoftPityStart: 100,
    mythicSoftPityStepPerMille: 10,
    mythicHardPity: 150,
  },
  mythic: {
    legendaryHardPity: 8,
    mythicSoftPityStart: null,
    mythicSoftPityStepPerMille: 0,
    mythicHardPity: 40,
  },
};
