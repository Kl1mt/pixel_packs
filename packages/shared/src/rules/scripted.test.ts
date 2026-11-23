import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../rng/rng.js';
import { rollScriptedPack } from './scripted.js';
import { M1_INDEX } from './testUtils.js';

const pack = { kind: 'realm', realm: 'mossgrove' } as const;
const pity = { packsSinceLegendaryPlus: 5, packsSinceMythic: 5 };

describe('scripted onboarding packs', () => {
  it('pack 1 always has an Epic featured card; the rest roll normally', () => {
    const rng = createSeededRng('onboarding-1');
    const variants = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const roll = rollScriptedPack(0, pack, pity, M1_INDEX, rng);
      expect(roll.cards[4]?.rarity).toBe('epic');
      expect(roll.scripted).toBe(true);
      expect(roll.pity).toEqual(pity);
      variants.add(roll.cards[4]?.variant ?? '');
    }
    expect(variants.has('foil')).toBe(true); // the variant isn't forced
  });

  it('pack 2 always has a Foil featured card of a normally rolled rarity', () => {
    const rng = createSeededRng('onboarding-2');
    const rarities = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const roll = rollScriptedPack(1, pack, pity, M1_INDEX, rng);
      expect(roll.cards[4]?.variant).toBe('foil');
      expect(roll.cards[4]?.rarity).not.toBe('common');
      expect(roll.pity).toEqual(pity);
      rarities.add(roll.cards[4]?.rarity ?? '');
    }
    expect(rarities.size).toBeGreaterThan(2);
  });

  it('does not count towards pity even when pity would trigger', () => {
    const due = { packsSinceLegendaryPlus: 39, packsSinceMythic: 149 };
    const roll = rollScriptedPack(0, pack, due, M1_INDEX, createSeededRng(3));
    expect(roll.pityTrigger).toBeNull();
    expect(roll.pity).toEqual(due);
  });

  it('rejects unknown steps', () => {
    expect(() => rollScriptedPack(2, pack, pity, M1_INDEX, createSeededRng(1))).toThrow(RangeError);
  });
});
