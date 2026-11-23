import {
  BASE_SLOT_RARITY,
  ENABLED_REALMS,
  MYTHIC_PACK_FEATURED_RARITY,
  REALM_COMPOSITION,
  REALM_FEATURED_RARITY,
  REALM_PACK_OWN_REALM_PERCENT,
  SLOTS_PER_PACK,
  type WeightTable,
} from '../config/odds.js';
import { RARITIES, type Rarity, type Realm } from '../model/enums.js';
import type { PackType } from '../model/pack.js';
import { totalWeight } from './weighted.js';

/** Base odds without pity, computed from the config (for the "?" screen and tests). */
export function rarityProbabilities(table: WeightTable<Rarity>): Record<Rarity, number> {
  const total = totalWeight(table);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITIES) out[r] = (table[r] ?? 0) / total;
  return out;
}

/** Expected number of cards of each rarity per pack (no pity). */
export function expectedRarityPerPack(pack: PackType): Record<Rarity, number> {
  const base = rarityProbabilities(BASE_SLOT_RARITY);
  const featured = rarityProbabilities(
    pack.kind === 'realm' ? REALM_FEATURED_RARITY : MYTHIC_PACK_FEATURED_RARITY,
  );
  const out = {} as Record<Rarity, number>;
  for (const r of RARITIES) out[r] = (SLOTS_PER_PACK - 1) * base[r] + featured[r];
  return out;
}

/** Chance that one card of `pack` comes from `realm`. */
export function realmProbability(
  pack: PackType,
  realm: Realm,
  enabledRealms: readonly Realm[] = ENABLED_REALMS,
): number {
  if (!enabledRealms.includes(realm)) return 0;
  const any = 1 / enabledRealms.length;
  if (pack.kind === 'mythic') return any;
  const own = REALM_PACK_OWN_REALM_PERCENT / 100;
  return (pack.realm === realm ? own : 0) + (1 - own) * any;
}

/** Expected copies per pack of one specific card of `rarity` in the pack's own realm. */
export function expectedCopiesOfSpecificCard(
  pack: Extract<PackType, { kind: 'realm' }>,
  rarity: Rarity,
  enabledRealms: readonly Realm[] = ENABLED_REALMS,
): number {
  return (
    (expectedRarityPerPack(pack)[rarity] * realmProbability(pack, pack.realm, enabledRealms)) /
    REALM_COMPOSITION[rarity]
  );
}

/** Chance that a pack (no pity) holds at least one card of `rarity` or better. */
export function chanceOfAtLeast(pack: PackType, rarity: Rarity): number {
  const idx = RARITIES.indexOf(rarity);
  const atLeast = (p: Record<Rarity, number>): number =>
    RARITIES.slice(idx).reduce((s, r) => s + p[r], 0);
  const base = atLeast(rarityProbabilities(BASE_SLOT_RARITY));
  const featured = atLeast(
    rarityProbabilities(
      pack.kind === 'realm' ? REALM_FEATURED_RARITY : MYTHIC_PACK_FEATURED_RARITY,
    ),
  );
  return 1 - (1 - base) ** (SLOTS_PER_PACK - 1) * (1 - featured);
}
