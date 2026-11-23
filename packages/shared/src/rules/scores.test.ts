import { describe, expect, it } from 'vitest';
import { CRAFT_COST, dustValue, starEquivalents, variantDustBonus } from './dust.js';
import { editionStampFor } from './edition.js';
import { MINTED_VARIANTS, needsMintNumber } from './mint.js';
import { collectionScore, pullScore } from './scores.js';

describe('pull score (GDD §15)', () => {
  it('multiplies rarity points by the variant multiplier', () => {
    expect(pullScore('common', 'normal')).toBe(1);
    expect(pullScore('epic', 'foil')).toBe(80);
    expect(pullScore('legendary', 'void')).toBe(2250);
    expect(pullScore('mythic', 'glitch')).toBe(24_000);
    expect(pullScore('rare', 'prismatic')).toBe(60);
  });
});

describe('collection score (GDD §15)', () => {
  it('counts each distinct (card, variant) once', () => {
    const score = collectionScore([
      { cardId: 'MOS-001', rarity: 'common', variant: 'normal', stars: 1 },
      { cardId: 'MOS-001', rarity: 'common', variant: 'normal', stars: 1 },
      { cardId: 'MOS-001', rarity: 'common', variant: 'foil', stars: 1 },
      { cardId: 'MOS-012', rarity: 'legendary', variant: 'normal', stars: 2 },
    ]);
    expect(score).toBe(1 + 2 + 150);
  });

  it('adds 50 % for an entry with a ★3 copy, rounded half up', () => {
    const score = collectionScore([
      { cardId: 'MOS-001', rarity: 'common', variant: 'normal', stars: 3 },
      { cardId: 'MOS-001', rarity: 'common', variant: 'normal', stars: 1 },
      { cardId: 'MOS-005', rarity: 'uncommon', variant: 'normal', stars: 3 },
      { cardId: 'MOS-012', rarity: 'legendary', variant: 'foil', stars: 3 },
    ]);
    expect(score).toBe(2 + 5 + 450);
  });

  it('is 0 for an empty collection', () => {
    expect(collectionScore([])).toBe(0);
  });
});

describe('dust (GDD §9)', () => {
  it('uses base × variant multiplier', () => {
    expect(dustValue('common', 'normal')).toBe(5);
    expect(dustValue('rare', 'foil')).toBe(100);
    expect(dustValue('epic', 'prismatic')).toBe(2000);
    expect(dustValue('legendary', 'void')).toBe(20_000);
    expect(dustValue('mythic', 'glitch')).toBe(150_000);
  });

  it('scales with ★1-equivalents so fusing keeps dust value', () => {
    expect(starEquivalents(1)).toBe(1);
    expect(starEquivalents(2)).toBe(3);
    expect(starEquivalents(3)).toBe(9);
    expect(dustValue('uncommon', 'normal', 2)).toBe(3 * dustValue('uncommon', 'normal'));
    expect(dustValue('uncommon', 'normal', 3)).toBe(9 * dustValue('uncommon', 'normal'));
  });

  it('refunds the variant bonus of an extra special fusion input', () => {
    expect(variantDustBonus('rare', 'void')).toBe(50 * 24);
    expect(variantDustBonus('rare', 'normal')).toBe(0);
  });

  it('crafting costs more than dusting returns', () => {
    for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const) {
      expect(CRAFT_COST[r]).toBeGreaterThan(dustValue(r, 'normal'));
    }
  });
});

describe('mint numbers and edition stamps (GDD §6)', () => {
  it('only Void and Glitch are minted', () => {
    expect(MINTED_VARIANTS).toEqual(['void', 'glitch']);
    expect(needsMintNumber('glitch')).toBe(true);
    expect(needsMintNumber('prismatic')).toBe(false);
  });

  it('stamps pack pulls during the release season only', () => {
    expect(editionStampFor('pack', 2, 2)).toEqual({ season: 2 });
    expect(editionStampFor('pack', 1, 2)).toBeNull();
    expect(editionStampFor('pack', 0, 0)).toBeNull();
    expect(editionStampFor('craft', 2, 2)).toBeNull();
    expect(editionStampFor('starter', 2, 2)).toBeNull();
    expect(editionStampFor('pack', null, 2)).toBeNull();
  });
});
