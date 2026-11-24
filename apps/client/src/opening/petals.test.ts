import { describe, expect, it } from 'vitest';
import { MASTER_PALETTE } from '@pixel-packs/shared';
import {
  PETAL_SHAPES,
  ambientPetal,
  petalFrame,
  petalPixels,
  stepPetals,
  type Petal,
  type PetalShape,
} from './petals.js';
import { MOSSGROVE_THEME, STARHOLLOW_THEME } from './themes.js';

const PALETTE = new Set<string>(Object.values(MASTER_PALETTE));
const SHAPES = Object.keys(PETAL_SHAPES) as PetalShape[];
const count = (g: readonly string[], c: string) => g.join('').split(c).length - 1;

describe('petal sprites (T22)', () => {
  it('Mossgrove drops a few sprite shapes in palette colours; Starhollow keeps its motes', () => {
    const shapes = new Set(MOSSGROVE_THEME.petals.map((l) => l.shape));
    expect(shapes.size).toBeGreaterThanOrEqual(3);
    expect(shapes.has(null)).toBe(false);
    for (const l of MOSSGROVE_THEME.petals) {
      expect(PALETTE.has(l.colour)).toBe(true);
      expect(PALETTE.has(l.shade)).toBe(true);
    }
    expect(STARHOLLOW_THEME.petals.every((l) => l.shape === null)).toBe(true);
  });

  it('tumbles: turns in quarter steps, narrows edge-on and shows its shaded back', () => {
    for (const shape of SHAPES) {
      const frames = Array.from({ length: 40 }, (_, i) => petalFrame(shape, i * 0.05, 0, 0.6));
      const keys = new Set(frames.map((f) => f.join('/')));
      expect(keys.size).toBeGreaterThan(3);
      // Some frame is at most one pixel wide (edge-on) and some shows more shade than face.
      expect(frames.some((f) => (f[0]?.length ?? 0) <= 1 || f.length <= 1)).toBe(true);
      expect(frames.some((f) => count(f, '+') > count(f, '#'))).toBe(true);
      // Never bigger than 4×4: small petals, not confetti blobs.
      for (const f of frames) {
        expect(f.length).toBeLessThanOrEqual(4);
        expect(f[0]?.length ?? 0).toBeLessThanOrEqual(4);
      }
    }
  });

  it('draws a sprite in its two colours, snapped to whole pixels', () => {
    const look = {
      colour: MASTER_PALETTE.blush,
      shade: MASTER_PALETTE.rose,
      shape: 'blossom' as const,
    };
    const p: Petal = { x: 10.4, y: 3.6, vx: 0, vy: 0, look, phase: 0, spin: 0, age: 0 };
    const px = petalPixels(p);
    expect(px.length).toBe(count(PETAL_SHAPES.blossom, '#') + count(PETAL_SHAPES.blossom, '+'));
    expect(new Set(px.map((q) => q[2]))).toEqual(new Set([look.colour, look.shade]));
    expect(Math.min(...px.map((q) => q[0]))).toBe(10);
    expect(Math.min(...px.map((q) => q[1]))).toBe(4);
  });

  it('falls and leaves the scene below the floor', () => {
    let r = 0;
    const rand = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    let petals = [ambientPetal(100, MOSSGROVE_THEME.petals, rand)];
    for (let i = 0; i < 20; i++) petals = stepPetals(petals, 0.05, 100);
    expect(petals[0]?.y).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) petals = stepPetals(petals, 0.05, 100);
    expect(petals).toHaveLength(0);
  });
});
