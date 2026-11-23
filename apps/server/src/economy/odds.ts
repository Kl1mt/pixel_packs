import {
  BASE_SLOT_RARITY,
  ENABLED_REALMS,
  MYTHIC_PACK_FEATURED_RARITY,
  PACK_PRICES,
  PITY_RULES,
  RARITY_SCALE,
  REALMS,
  REALM_FEATURED_RARITY,
  REALM_PACK_OWN_REALM_PERCENT,
  VARIANT_SCALE,
  pityGroupOf,
  variantTable,
  type OddsResponse,
  type PackType,
  type WeightTable,
} from '@pixel-packs/shared';

/** Weights → percentages, rounded to 4 decimals for display. */
function percent<K extends string>(table: WeightTable<K>, scale: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, w] of Object.entries(table)) {
    if (typeof w === 'number' && w > 0) out[key] = Math.round((w / scale) * 100 * 1e4) / 1e4;
  }
  return out;
}

/** The odds behind every pack's "?" (GDD §5), straight from `config/odds.ts`. */
export function oddsResponse(): OddsResponse {
  const packs: PackType[] = [
    ...REALMS.map((realm) => ({ kind: 'realm', realm }) as const),
    { kind: 'mythic' },
  ];
  return {
    packs: packs.map((p) => {
      const rules = PITY_RULES[pityGroupOf(p)];
      return {
        packTypeId: p.kind === 'realm' ? (`realm:${p.realm}` as const) : ('mythic' as const),
        price: { ...PACK_PRICES[p.kind] },
        enabled: p.kind === 'mythic' || ENABLED_REALMS.includes(p.realm),
        pityGroup: pityGroupOf(p),
        slotRarity: percent(BASE_SLOT_RARITY, RARITY_SCALE),
        featuredRarity: percent(
          p.kind === 'realm' ? REALM_FEATURED_RARITY : MYTHIC_PACK_FEATURED_RARITY,
          RARITY_SCALE,
        ),
        variants: percent(variantTable(p), VARIANT_SCALE),
        ownRealmPercent: p.kind === 'realm' ? REALM_PACK_OWN_REALM_PERCENT : null,
        pity: {
          legendaryHardPity: rules.legendaryHardPity,
          mythicSoftPityStart: rules.mythicSoftPityStart,
          mythicSoftPityStepPercent: rules.mythicSoftPityStepPerMille / 10,
          mythicHardPity: rules.mythicHardPity,
        },
      };
    }),
  };
}
