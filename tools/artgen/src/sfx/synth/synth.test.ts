import { describe, expect, it } from 'vitest';
import { fromRepo } from '../../paths.js';
import { loadSfxSpec } from '../spec.js';
import { synthCoverage } from './build.js';
import { encodeWav, renderSound, rng, SAMPLE_RATE, soundLength } from './engine.js';
import { SOUNDS } from './sounds.js';

describe('sfx synth', () => {
  it('has exactly one sound per clip of the T14 spec', async () => {
    const spec = await loadSfxSpec(fromRepo('tools/artgen/specs/t14-sfx.json'));
    expect(synthCoverage(spec)).toEqual({ missing: [], extra: [] });
  });

  it('renders every sound at its peak, never clipping, and short enough for a sprite', () => {
    for (const [id, def] of Object.entries(SOUNDS)) {
      const s = renderSound(def);
      let max = 0;
      for (const v of s) max = Math.max(max, Math.abs(v));
      expect(max, id).toBeCloseTo(def.peak, 5);
      expect(def.peak, id).toBeLessThanOrEqual(0.8);
      expect(s.length / SAMPLE_RATE, id).toBeLessThan(3.5);
      expect(s.length, id).toBe(Math.ceil(soundLength(def) * SAMPLE_RATE));
    }
  });

  it('is deterministic (seeded noise)', () => {
    const tear = SOUNDS['open.tear'];
    if (!tear) throw new Error('no tear');
    expect(renderSound(tear)).toEqual(renderSound(tear));
    const a = rng(1);
    const b = rng(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('writes a 16-bit mono WAV', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]));
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(wav.readUInt32LE(40)).toBe(6);
    expect(wav.readInt16LE(46)).toBe(32767);
    expect(wav.readInt16LE(48)).toBe(-32767);
  });
});
