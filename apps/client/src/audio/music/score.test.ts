import { describe, expect, it } from 'vitest';
import { arpeggio, beatsPerLoop, loopEvents, midiToHz, validateTrack } from './score.js';
import { TRACKS } from './tracks.js';

describe('music score', () => {
  it('keeps every note of every track inside its bar', () => {
    for (const t of Object.values(TRACKS)) expect(validateTrack(t)).toEqual([]);
  });

  it('gives every part of a track a whole number of bars that divides the loop', () => {
    for (const t of Object.values(TRACKS)) {
      for (const p of t.parts) expect(t.bars % p.bars.length).toBe(0);
    }
  });

  it('lays notes out in time order within one loop', () => {
    for (const t of Object.values(TRACKS)) {
      const ev = loopEvents(t);
      expect(ev.length).toBeGreaterThan(0);
      ev.forEach((e, i) => {
        expect(e.beat).toBeGreaterThanOrEqual(i > 0 ? (ev[i - 1]?.beat ?? 0) : 0);
        expect(e.beat + e.length).toBeLessThanOrEqual(beatsPerLoop(t));
      });
    }
  });

  it('has the rarity layers the opening scene asks for', () => {
    const layers = new Set(TRACKS.opening.parts.map((p) => p.layer));
    expect([...layers].sort()).toEqual(['base', 'epic', 'golden']);
  });

  it('builds arpeggios and converts pitch', () => {
    expect(arpeggio([60, 64, 67], 4)).toEqual([
      [0, 60, 4],
      [4, 64, 4],
      [8, 67, 4],
      [12, 60, 4],
    ]);
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });
});
