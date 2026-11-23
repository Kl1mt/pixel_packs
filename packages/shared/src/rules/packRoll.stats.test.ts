import { describe, expect, it } from 'vitest';
import { RARITIES, VARIANTS, type Rarity, type Variant } from '../model/enums.js';
import { FRESH_PITY, type PackType } from '../model/pack.js';
import { createSeededRng } from '../rng/rng.js';
import {
  expectedCopiesOfSpecificCard,
  expectedRarityPerPack,
  realmProbability,
} from './expected.js';
import { rollPack, variantTable } from './packRoll.js';
import { M1_INDEX, tolerance } from './testUtils.js';
import { totalWeight } from './weighted.js';

const N = 100_000;

function simulate(pack: PackType, seed: string) {
  const rng = createSeededRng(seed);
  const rarity = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  const variant = Object.fromEntries(VARIANTS.map((v) => [v, 0])) as Record<Variant, number>;
  const byCard = new Map<string, number>();
  let starhollow = 0;
  for (let i = 0; i < N; i++) {
    // Fresh counters every pack: this measures the base odds, without pity.
    const roll = rollPack(pack, FRESH_PITY, M1_INDEX, rng);
    expect(roll.cards[4]?.rarity).not.toBe('common');
    for (const c of roll.cards) {
      rarity[c.rarity]++;
      variant[c.variant]++;
      byCard.set(c.cardId, (byCard.get(c.cardId) ?? 0) + 1);
      if (c.realm === 'starhollow') starhollow++;
    }
  }
  return { rarity, variant, byCard, starhollow };
}

describe.each<[string, PackType]>([
  ['realm pack', { kind: 'realm', realm: 'mossgrove' }],
  ['mythic pack', { kind: 'mythic' }],
])('100k %s rolls', (_, pack) => {
  const result = simulate(pack, `stats-${pack.kind}`);
  const cards = N * 5;

  it('rarity counts match the config', () => {
    const per = expectedRarityPerPack(pack);
    for (const r of RARITIES) {
      const p = per[r] / 5;
      expect(Math.abs(result.rarity[r] - cards * p)).toBeLessThan(tolerance(cards, p));
    }
  });

  it('variant counts match the config', () => {
    const table = variantTable(pack);
    const total = totalWeight(table);
    for (const v of VARIANTS) {
      const p = (table[v] ?? 0) / total;
      expect(Math.abs(result.variant[v] - cards * p)).toBeLessThan(tolerance(cards, p));
    }
  });

  it('realm split matches the config', () => {
    const p = realmProbability(pack, 'starhollow');
    expect(Math.abs(result.starhollow - cards * p)).toBeLessThan(tolerance(cards, p));
  });
});

describe('rarity invariant, measured', () => {
  it('a specific own-realm card appears less often the rarer it is', () => {
    const pack = { kind: 'realm', realm: 'mossgrove' } as const;
    const { byCard } = simulate(pack, 'invariant');
    // Placeholder ids are numbered by rarity: MOS-001..004 C, 005..007 U, 008..009 R, ...
    const firstOfRarity = ['MOS-001', 'MOS-005', 'MOS-008', 'MOS-010', 'MOS-012', 'MOS-013'];
    const measured = firstOfRarity.map((id) => (byCard.get(id) ?? 0) / N);
    for (let i = 1; i < measured.length; i++) {
      expect(measured[i]).toBeLessThan(measured[i - 1] ?? 0);
    }
    RARITIES.forEach((r, i) => {
      const expected = expectedCopiesOfSpecificCard(pack, r);
      expect(Math.abs((measured[i] ?? 0) - expected)).toBeLessThan(
        tolerance(N, expected) / N + 0.001,
      );
    });
  });
});
