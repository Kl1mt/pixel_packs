import { z } from 'zod';

/** The five realms (GDD §3). Order is the canonical display order. */
export const REALMS = ['hearthfire', 'tidepool', 'mossgrove', 'skyloft', 'starhollow'] as const;
export const RealmSchema = z.enum(REALMS);
export type Realm = z.infer<typeof RealmSchema>;

/** Three-letter card-id prefix per realm (GDD §4: `<REALM>-<NNN>`). */
export const REALM_CODES: Readonly<Record<Realm, string>> = {
  hearthfire: 'HEA',
  tidepool: 'TID',
  mossgrove: 'MOS',
  skyloft: 'SKY',
  starhollow: 'STA',
};

/** Rarities in ascending order (GDD §5). */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;
export const RaritySchema = z.enum(RARITIES);
export type Rarity = z.infer<typeof RaritySchema>;

/** 0 = Common … 5 = Mythic. The card face shows `rarityRank + 1` pips. */
export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

/** Variants in ascending rank (GDD §6): Glitch > Void > Prismatic > Foil > Normal. */
export const VARIANTS = ['normal', 'foil', 'prismatic', 'void', 'glitch'] as const;
export const VariantSchema = z.enum(VARIANTS);
export type Variant = z.infer<typeof VariantSchema>;

export function variantRank(variant: Variant): number {
  return VARIANTS.indexOf(variant);
}
