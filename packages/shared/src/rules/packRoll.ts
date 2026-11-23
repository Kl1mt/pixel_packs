import {
  BASE_SLOT_RARITY,
  FEATURED_SLOT,
  MYTHIC_PACK_FEATURED_RARITY,
  MYTHIC_PACK_VARIANT_MULTIPLIER,
  PITY_RULES,
  REALM_FEATURED_RARITY,
  REALM_PACK_OWN_REALM_PERCENT,
  SLOTS_PER_PACK,
  VARIANT_CHANCES,
  VARIANT_SCALE,
  type WeightTable,
} from '../config/odds.js';
import { RARITIES, rarityRank, type Rarity, type Realm, type Variant } from '../model/enums.js';
import type {
  PackRoll,
  PackType,
  PityCounters,
  PityGroup,
  PityTrigger,
  RolledCard,
} from '../model/pack.js';
import type { Rng } from '../rng/rng.js';
import { cardsOf, type CatalogIndex } from './catalog.js';
import { pickOne, pickWeighted } from './weighted.js';

export function pityGroupOf(pack: PackType): PityGroup {
  return pack.kind === 'realm' ? 'realm' : 'mythic';
}

/** Variant weights out of `VARIANT_SCALE`, including Normal. */
export function variantTable(pack: PackType): WeightTable<Variant> {
  const mult = pack.kind === 'mythic' ? MYTHIC_PACK_VARIANT_MULTIPLIER : 1;
  const foil = VARIANT_CHANCES.foil * mult;
  const prismatic = VARIANT_CHANCES.prismatic * mult;
  const voidW = VARIANT_CHANCES.void * mult;
  const glitch = VARIANT_CHANCES.glitch * mult;
  const normal = VARIANT_SCALE - foil - prismatic - voidW - glitch;
  return { normal, foil, prismatic, void: voidW, glitch };
}

/** Moves `bonus` weight onto Mythic, taken from the lowest rarities first. */
function shiftToMythic(table: WeightTable<Rarity>, bonus: number): WeightTable<Rarity> {
  const out: Partial<Record<Rarity, number>> = { ...table };
  let left = bonus;
  for (const rarity of RARITIES) {
    if (rarity === 'mythic' || left === 0) break;
    const take = Math.min(out[rarity] ?? 0, left);
    out[rarity] = (out[rarity] ?? 0) - take;
    left -= take;
  }
  out.mythic = (out.mythic ?? 0) + bonus - left;
  return out;
}

export interface FeaturedOdds {
  table: WeightTable<Rarity>;
  trigger: PityTrigger;
  mythicSoftPityBonus: number;
}

/** Featured-slot rarity odds for the next pack, given the group's pity counters. */
export function featuredRarityOdds(pack: PackType, pity: PityCounters): FeaturedOdds {
  const rules = PITY_RULES[pityGroupOf(pack)];
  const base = pack.kind === 'realm' ? REALM_FEATURED_RARITY : MYTHIC_PACK_FEATURED_RARITY;
  const nthWithoutMythic = pity.packsSinceMythic + 1;
  const nthWithoutLegendary = pity.packsSinceLegendaryPlus + 1;

  if (nthWithoutMythic >= rules.mythicHardPity) {
    return { table: { mythic: 1 }, trigger: 'mythicHard', mythicSoftPityBonus: 0 };
  }
  const start = rules.mythicSoftPityStart;
  const bonus =
    start !== null && nthWithoutMythic >= start
      ? (nthWithoutMythic - start + 1) * rules.mythicSoftPityStepPerMille
      : 0;
  const table = bonus > 0 ? shiftToMythic(base, bonus) : base;

  if (nthWithoutLegendary >= rules.legendaryHardPity) {
    return {
      table: { legendary: table.legendary ?? 0, mythic: table.mythic ?? 0 },
      trigger: 'legendaryHard',
      mythicSoftPityBonus: bonus,
    };
  }
  return { table, trigger: null, mythicSoftPityBonus: bonus };
}

function rollRealm(rng: Rng, pack: PackType, index: CatalogIndex): Realm {
  if (pack.kind === 'realm' && rng.int(100) < REALM_PACK_OWN_REALM_PERCENT) return pack.realm;
  return pickOne(rng, index.enabledRealms);
}

/** Counters after opening a pack that contained `cards`. */
export function nextPity(pity: PityCounters, cards: readonly RolledCard[]): PityCounters {
  const best = Math.max(...cards.map((c) => rarityRank(c.rarity)));
  return {
    packsSinceLegendaryPlus: best >= rarityRank('legendary') ? 0 : pity.packsSinceLegendaryPlus + 1,
    packsSinceMythic: best >= rarityRank('mythic') ? 0 : pity.packsSinceMythic + 1,
  };
}

/** Overrides for the featured slot of a scripted onboarding pack (GDD §17). */
export interface FeaturedScript {
  rarity?: Rarity;
  variant?: Variant;
}

/**
 * Shared roller. With a `script`, the pack is scripted: the featured slot follows the
 * script, everything else rolls normally, and pity is neither used nor advanced.
 */
export function rollPackInternal(
  pack: PackType,
  pity: PityCounters,
  index: CatalogIndex,
  rng: Rng,
  script: FeaturedScript | null,
): PackRoll {
  if (pack.kind === 'realm' && !index.enabledRealms.includes(pack.realm)) {
    throw new Error(`realm ${pack.realm} is not enabled`);
  }
  const odds: FeaturedOdds = script
    ? { table: REALM_FEATURED_RARITY, trigger: null, mythicSoftPityBonus: 0 }
    : featuredRarityOdds(pack, pity);
  const variants = variantTable(pack);

  const cards: RolledCard[] = [];
  for (let slot = 1; slot <= SLOTS_PER_PACK; slot++) {
    const featured = slot === FEATURED_SLOT;
    const rarity =
      featured && script?.rarity
        ? script.rarity
        : pickWeighted(rng, featured ? odds.table : BASE_SLOT_RARITY);
    const realm = rollRealm(rng, pack, index);
    const cardId = pickOne(rng, cardsOf(index, realm, rarity));
    const variant = featured && script?.variant ? script.variant : pickWeighted(rng, variants);
    cards.push({ slot, featured, cardId, realm, rarity, variant });
  }
  return {
    cards,
    pity: script ? { ...pity } : nextPity(pity, cards),
    pityTrigger: odds.trigger,
    mythicSoftPityBonus: odds.mythicSoftPityBonus,
    scripted: script !== null,
  };
}

/**
 * Rolls a pack (GDD §5, §7): each card rolls rarity → realm → card → variant.
 * `pity` holds the counters of the pack's pity group; the result carries the new ones.
 */
export function rollPack(
  pack: PackType,
  pity: PityCounters,
  index: CatalogIndex,
  rng: Rng,
): PackRoll {
  return rollPackInternal(pack, pity, index, rng, null);
}

/** Reveal order (GDD §7): slots 1–4 by ascending rarity (stable), the featured slot last. */
export function revealOrder(cards: readonly RolledCard[]): RolledCard[] {
  const rest = cards.filter((c) => !c.featured);
  rest.sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.slot - b.slot);
  return [...rest, ...cards.filter((c) => c.featured)];
}
