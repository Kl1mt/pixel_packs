import { describe, expect, it } from 'vitest';
import { formatReport } from './report.js';
import { DEFAULT_PARAMS, simulate } from './sim.js';

describe('econ-sim', () => {
  const params = { ...DEFAULT_PARAMS, days: 30, players: 50 };
  const results = simulate(params);

  it('opens 3.5 packs/day with the M1 sources', () => {
    const perDay = results.reduce((s, r) => s + r.packs, 0) / results.length / params.days;
    expect(perDay).toBeCloseTo(3.5, 1);
  });

  it('crafting never makes completion slower', () => {
    for (const r of results) {
      if (r.nonMythicLuck !== null)
        expect(r.nonMythicCraft ?? Infinity).toBeLessThanOrEqual(r.nonMythicLuck);
      if (r.allLuck !== null) expect(r.allCraft ?? Infinity).toBeLessThanOrEqual(r.allLuck);
    }
  });

  it('is deterministic per seed and prints a report', () => {
    expect(simulate(params)).toEqual(results);
    expect(formatReport(params, results)).toContain('packs/day: 3.50');
  });
});
