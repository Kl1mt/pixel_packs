import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { imageStats } from './png.js';
import { recentreOffsetX, sameUpToTranslation, translate } from './shift.js';

function sprite(x0: number, x1: number): PNG {
  const png = new PNG({ width: 8, height: 4 });
  for (let x = x0; x <= x1; x++) {
    const i = (1 * 8 + x) * 4;
    png.data.set([x * 10, 20, 30, 255], i);
  }
  return png;
}

describe('pixel shifting', () => {
  it('re-centres the opaque bbox without changing pixels', () => {
    const png = sprite(4, 7); // touches the right edge
    expect(recentreOffsetX(png)).toBe(-2);
    const moved = translate(png, recentreOffsetX(png), 0);
    expect(imageStats(moved).bbox).toEqual({ x0: 2, y0: 1, x1: 5, y1: 1 });
    expect(sameUpToTranslation(png, moved)).toBe(true);
  });

  it('ignores the RGB of fully transparent pixels', () => {
    const a = sprite(1, 3);
    const b = sprite(1, 3);
    b.data.set([9, 9, 9, 0], 0);
    expect(sameUpToTranslation(a, b)).toBe(true);
  });

  it('refuses shifts that push pixels off the canvas', () => {
    expect(() => translate(sprite(4, 7), 1, 0)).toThrow(/off the canvas/);
  });

  it('tells different sprites apart', () => {
    const a = sprite(1, 3);
    const b = sprite(1, 3);
    b.data[(1 * 8 + 2) * 4] = 99;
    expect(sameUpToTranslation(a, b)).toBe(false);
    expect(sameUpToTranslation(a, sprite(1, 4))).toBe(false);
  });
});
