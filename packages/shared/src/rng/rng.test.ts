import { describe, expect, it } from 'vitest';
import { createCryptoRng, createSeededRng } from './rng.js';

describe('createSeededRng', () => {
  it('is deterministic per seed', () => {
    const a = createSeededRng('battle-42');
    const b = createSeededRng('battle-42');
    const c = createSeededRng('battle-43');
    const seqA = Array.from({ length: 20 }, () => a.int(1000));
    expect(Array.from({ length: 20 }, () => b.int(1000))).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => c.int(1000))).not.toEqual(seqA);
  });

  it('stays in range and is roughly uniform', () => {
    const rng = createSeededRng(1);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 70_000; i++) {
      const x = rng.int(7);
      expect(x).toBeGreaterThanOrEqual(0);
      counts[x] = (counts[x] ?? 0) + 1;
    }
    for (const n of counts) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });

  it('rejects bad bounds', () => {
    const rng = createSeededRng(1);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(1.5)).toThrow(RangeError);
    expect(() => rng.int(2 ** 33)).toThrow(RangeError);
    expect(rng.int(1)).toBe(0);
  });
});

describe('createCryptoRng', () => {
  it('stays in range and covers every value', () => {
    const rng = createCryptoRng();
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const x = rng.int(10);
      expect(Number.isInteger(x) && x >= 0 && x < 10).toBe(true);
      seen.add(x);
    }
    expect(seen.size).toBe(10);
    expect(rng.int(2 ** 32)).toBeLessThan(2 ** 32);
  });
});
