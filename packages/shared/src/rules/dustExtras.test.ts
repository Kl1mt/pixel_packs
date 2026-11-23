import { describe, expect, it } from 'vitest';
import type { Stars } from '../model/card.js';
import type { Variant } from '../model/enums.js';
import {
  canDust,
  dustTotal,
  isPlainCopy,
  planDustExtras,
  type DustableCopy,
} from './dustExtras.js';

let n = 0;
function copy(
  cardId: string,
  over: Partial<Omit<DustableCopy, 'cardId'>> & { variant?: Variant; stars?: Stars } = {},
): DustableCopy {
  n += 1;
  return {
    id: `c${n}`,
    cardId,
    rarity: 'common',
    variant: 'normal',
    stars: 1,
    editionSeason: null,
    mintNumber: null,
    accountBound: false,
    ...over,
  };
}

describe('dust extras', () => {
  it('keeps 9 equivalents per card and dusts only the plain copies beyond', () => {
    const copies = Array.from({ length: 12 }, () => copy('MOS-001'));
    const plan = planDustExtras(copies);
    expect(plan.copyIds).toHaveLength(3);
    expect(plan.dust).toBe(15);
  });

  it('counts special copies towards the 9 but never dusts them', () => {
    const specials = [
      copy('MOS-001', { variant: 'foil' }),
      copy('MOS-001', { editionSeason: 1 }),
      copy('MOS-001', { variant: 'void', mintNumber: 3 }),
      copy('MOS-001', { accountBound: true }),
    ];
    const plain = Array.from({ length: 6 }, () => copy('MOS-001'));
    const plan = planDustExtras([...specials, ...plain]);
    expect(plan.copyIds).toEqual([plain[0]?.id]);
  });

  it('dusts lowest stars first and respects ★ equivalents', () => {
    const star3 = copy('MOS-002', { stars: 3, rarity: 'rare' });
    const star2 = copy('MOS-002', { stars: 2, rarity: 'rare' });
    const ones = [copy('MOS-002', { rarity: 'rare' }), copy('MOS-002', { rarity: 'rare' })];
    // 9 + 3 + 2 = 14 → 5 excess: both ★1 (2) and the ★2 (3).
    const plan = planDustExtras([star3, star2, ...ones]);
    expect(plan.copyIds.sort()).toEqual([star2.id, ...ones.map((c) => c.id)].sort());
    expect(plan.dust).toBe(50 * 5);
  });

  it('does nothing at or below 9 equivalents', () => {
    expect(planDustExtras([copy('A'), copy('A', { stars: 2 })]).copyIds).toEqual([]);
    expect(planDustExtras([copy('B', { stars: 3 })]).copyIds).toEqual([]);
  });

  it('classifies copies', () => {
    expect(isPlainCopy(copy('X'))).toBe(true);
    expect(isPlainCopy(copy('X', { variant: 'foil' }))).toBe(false);
    expect(canDust(copy('X', { variant: 'glitch', mintNumber: 1 }))).toBe(true);
    expect(canDust(copy('X', { accountBound: true }))).toBe(false);
    expect(dustTotal([copy('X', { rarity: 'mythic', variant: 'glitch' })])).toBe(2500 * 60);
  });
});
