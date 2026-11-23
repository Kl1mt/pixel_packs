import { describe, expect, it } from 'vitest';
import { clampInt } from './math.js';

describe('clampInt', () => {
  it('keeps values inside the range', () => {
    expect(clampInt(5, 0, 10)).toBe(5);
  });

  it('clamps to the bounds', () => {
    expect(clampInt(-3, 0, 10)).toBe(0);
    expect(clampInt(42, 0, 10)).toBe(10);
    expect(clampInt(Infinity, 0, 10)).toBe(10);
  });

  it('truncates non-integers toward zero', () => {
    expect(clampInt(3.9, 0, 10)).toBe(3);
    expect(clampInt(-0.5, -5, 5)).toBe(0);
  });

  it('rejects bad input', () => {
    expect(() => clampInt(1, 5, 0)).toThrow(RangeError);
    expect(() => clampInt(1, 0.5, 2)).toThrow(RangeError);
    expect(() => clampInt(Number.NaN, 0, 1)).toThrow(RangeError);
  });
});
