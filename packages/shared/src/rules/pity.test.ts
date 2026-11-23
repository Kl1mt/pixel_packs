import { describe, expect, it } from 'vitest';
import { rarityRank } from '../model/enums.js';
import { FRESH_PITY, type PackType, type PityCounters } from '../model/pack.js';
import { createSeededRng, type Rng } from '../rng/rng.js';
import { featuredRarityOdds, nextPity, rollPack } from './packRoll.js';
import { M1_INDEX, ZERO_RNG } from './testUtils.js';

const realmPack: PackType = { kind: 'realm', realm: 'starhollow' };
const mythicPack: PackType = { kind: 'mythic' };

/** Opens `packs` packs in a row and returns the 1-based numbers of those where `hit` holds. */
function openUntil(pack: PackType, rng: Rng, packs: number, hit: (best: number) => boolean) {
  let pity: PityCounters = FRESH_PITY;
  const hits: number[] = [];
  for (let n = 1; n <= packs; n++) {
    const roll = rollPack(pack, pity, M1_INDEX, rng);
    if (hit(Math.max(...roll.cards.map((c) => rarityRank(c.rarity))))) hits.push(n);
    pity = roll.pity;
  }
  return hits;
}

const isLegendaryPlus = (best: number) => best >= rarityRank('legendary');
const isMythic = (best: number) => best >= rarityRank('mythic');

describe('realm pack pity', () => {
  it('forces Legendary+ in the featured slot of exactly the 40th pack', () => {
    const hits = openUntil(realmPack, ZERO_RNG, 120, isLegendaryPlus);
    expect(hits).toEqual([40, 80, 120]);
  });

  it('marks the pack that triggered pity', () => {
    const roll = rollPack(
      realmPack,
      { packsSinceLegendaryPlus: 39, packsSinceMythic: 39 },
      M1_INDEX,
      ZERO_RNG,
    );
    expect(roll.pityTrigger).toBe('legendaryHard');
    expect(roll.cards[4]?.rarity).toBe('legendary');
    expect(roll.pity).toEqual({ packsSinceLegendaryPlus: 0, packsSinceMythic: 40 });
  });

  it('forces a Mythic on exactly the 150th pack', () => {
    expect(openUntil(realmPack, ZERO_RNG, 300, isMythic)).toEqual([150, 300]);
  });

  it('soft pity adds 1 pp per pack from pack 100', () => {
    const at = (since: number) =>
      featuredRarityOdds(realmPack, { packsSinceLegendaryPlus: 0, packsSinceMythic: since });
    expect(at(98).table.mythic).toBe(8);
    expect(at(99).mythicSoftPityBonus).toBe(10); // the 100th pack
    expect(at(99).table.mythic).toBe(18);
    expect(at(99).table.uncommon).toBe(540);
    expect(at(148).table.mythic).toBe(508); // the 149th pack
    expect(at(149).trigger).toBe('mythicHard');
  });

  it('a Legendary+ anywhere resets the Legendary counter; a Legendary keeps the Mythic one', () => {
    const card = (rarity: 'common' | 'legendary' | 'mythic', slot: number) => ({
      slot,
      featured: slot === 5,
      cardId: 'MOS-001',
      realm: 'mossgrove' as const,
      rarity,
      variant: 'normal' as const,
    });
    const pity = { packsSinceLegendaryPlus: 12, packsSinceMythic: 77 };
    const commons = [1, 2, 3, 4, 5].map((s) => card('common', s));
    expect(nextPity(pity, commons)).toEqual({ packsSinceLegendaryPlus: 13, packsSinceMythic: 78 });
    const withLegendary = [card('legendary', 1), ...commons.slice(1)];
    expect(nextPity(pity, withLegendary)).toEqual({
      packsSinceLegendaryPlus: 0,
      packsSinceMythic: 78,
    });
    const withMythic = [...commons.slice(0, 4), card('mythic', 5)];
    expect(nextPity(pity, withMythic)).toEqual({ packsSinceLegendaryPlus: 0, packsSinceMythic: 0 });
  });

  it('with real luck, no gap exceeds the hard pity', () => {
    const rng = createSeededRng('pity-gaps');
    const gaps = (hits: number[]) => hits.map((h, i) => h - (hits[i - 1] ?? 0));
    const legendary = openUntil(realmPack, rng, 20_000, isLegendaryPlus);
    expect(Math.max(...gaps(legendary))).toBeLessThanOrEqual(40);
    const mythic = openUntil(realmPack, createSeededRng('pity-gaps-m'), 20_000, isMythic);
    expect(Math.max(...gaps(mythic))).toBeLessThanOrEqual(150);
    // Pity lifts the Mythic rate a little above the base 1.2 %.
    expect(mythic.length / 20_000).toBeGreaterThan(0.012);
  });
});

describe('Mythic pack pity', () => {
  it('forces Legendary+ by the 8th pack and a Mythic on the 40th', () => {
    expect(openUntil(mythicPack, ZERO_RNG, 16, isLegendaryPlus)).toEqual([8, 16]);
    expect(openUntil(mythicPack, ZERO_RNG, 80, isMythic)).toEqual([40, 80]);
  });

  it('has no soft pity', () => {
    const odds = featuredRarityOdds(mythicPack, {
      packsSinceLegendaryPlus: 0,
      packsSinceMythic: 38,
    });
    expect(odds.mythicSoftPityBonus).toBe(0);
    expect(odds.table).toEqual({ epic: 750, legendary: 200, mythic: 50 });
  });
});
