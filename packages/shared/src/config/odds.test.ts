import { describe, expect, it } from 'vitest';
import { RARITIES, REALMS, type Realm } from '../model/enums.js';
import {
  chanceOfAtLeast,
  expectedCopiesOfSpecificCard,
  expectedRarityPerPack,
} from '../rules/expected.js';
import { totalWeight } from '../rules/weighted.js';
import {
  BASE_SLOT_RARITY,
  MYTHIC_PACK_FEATURED_RARITY,
  RARITY_SCALE,
  REALM_COMPOSITION,
  REALM_FEATURED_RARITY,
  VARIANT_CHANCES,
  VARIANT_SCALE,
} from './odds.js';

const realmPack = { kind: 'realm', realm: 'mossgrove' } as const;

describe('odds config', () => {
  it('rarity tables sum to the scale', () => {
    expect(totalWeight(BASE_SLOT_RARITY)).toBe(RARITY_SCALE);
    expect(totalWeight(REALM_FEATURED_RARITY)).toBe(RARITY_SCALE);
    expect(totalWeight(MYTHIC_PACK_FEATURED_RARITY)).toBe(RARITY_SCALE);
  });

  it('featured slot of a realm pack is never Common', () => {
    expect(REALM_FEATURED_RARITY.common ?? 0).toBe(0);
  });

  it('variant chances match GDD §6 exactly', () => {
    expect(VARIANT_CHANCES.foil / VARIANT_SCALE).toBe(1 / 12);
    expect(VARIANT_CHANCES.prismatic / VARIANT_SCALE).toBe(1 / 150);
    expect(VARIANT_CHANCES.void / VARIANT_SCALE).toBe(1 / 400);
    expect(VARIANT_CHANCES.glitch / VARIANT_SCALE).toBeCloseTo(1 / 1500, 12);
  });

  it('a realm has 13 cards', () => {
    expect(Object.values(REALM_COMPOSITION).reduce((a, b) => a + b, 0)).toBe(13);
  });

  it('per-pack figures match GDD §5', () => {
    const per = expectedRarityPerPack(realmPack);
    expect(per.common).toBeCloseTo(2.8, 2);
    expect(per.uncommon).toBeCloseTo(1.43, 2);
    expect(per.rare).toBeCloseTo(0.56, 2);
    expect(per.epic).toBeCloseTo(0.154, 3);
    expect(per.legendary).toBeCloseTo(0.044, 3);
    expect(per.mythic).toBeCloseTo(0.012, 3);
    expect(chanceOfAtLeast(realmPack, 'rare')).toBeCloseTo(0.6, 1);
    expect(chanceOfAtLeast(realmPack, 'epic')).toBeCloseTo(0.2, 1);
    expect(chanceOfAtLeast(realmPack, 'legendary')).toBeCloseTo(0.055, 3);
    expect(chanceOfAtLeast(realmPack, 'mythic')).toBeCloseTo(0.012, 3);
  });
});

describe('rarity invariant (GDD §5)', () => {
  const cases: [string, readonly Realm[]][] = [
    ['M1 realms', ['mossgrove', 'starhollow']],
    ['all five realms', REALMS],
  ];
  it.each(cases)('a specific card gets strictly rarer with rarity (%s)', (_, enabled) => {
    const copies = RARITIES.map((r) => expectedCopiesOfSpecificCard(realmPack, r, enabled));
    for (let i = 1; i < copies.length; i++) {
      expect(copies[i]).toBeLessThan(copies[i - 1] ?? 0);
    }
  });

  it('matches the GDD table with five realms', () => {
    const copies = RARITIES.map((r) => expectedCopiesOfSpecificCard(realmPack, r, REALMS));
    const gdd = [0.59, 0.4, 0.24, 0.065, 0.037, 0.01];
    copies.forEach((c, i) => {
      expect(c).toBeCloseTo(gdd[i] ?? 0, 2);
    });
  });
});
