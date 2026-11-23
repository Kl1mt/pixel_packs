import { describe, expect, it } from 'vitest';
import type { PityMeter } from '@pixel-packs/shared';
import { percentText, pityProgress } from './format.js';

const meter = (since: number): PityMeter => ({
  group: 'realm',
  packsSinceLegendaryPlus: since,
  packsSinceMythic: since,
  legendaryHardPity: 40,
  mythicSoftPityStart: 100,
  mythicHardPity: 150,
});

describe('pack shelf formatting', () => {
  it('writes percentages without float noise', () => {
    expect(percentText(70)).toBe('70 %');
    expect(percentText(0.1)).toBe('0.1 %');
    expect(percentText(1.6000000001)).toBe('1.6 %');
  });

  it('counts down to the 40th pack, where the guarantee lands', () => {
    expect(pityProgress(meter(0))).toEqual({ left: 40, fill: 0 });
    // After 39 misses the next pack is the guaranteed one.
    expect(pityProgress(meter(39))).toEqual({ left: 1, fill: 1 });
    expect(pityProgress(meter(20)).left).toBe(20);
  });
});
