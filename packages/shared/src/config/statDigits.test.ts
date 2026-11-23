import { describe, expect, it } from 'vitest';
import { CARD_FACE } from './cardFace.js';
import { STAT_DIGITS, STAT_DIGIT_HEIGHT, statDigitPixels, statRunWidth } from './statDigits.js';

const bbox = (px: { x: number; y: number }[]) => ({
  x0: Math.min(...px.map((p) => p.x)),
  x1: Math.max(...px.map((p) => p.x)),
  y0: Math.min(...px.map((p) => p.y)),
  y1: Math.max(...px.map((p) => p.y)),
});

describe('stat digits', () => {
  it('has a 7-row glyph with equal-width rows for every digit', () => {
    for (let d = 0; d <= 9; d++) {
      const g = STAT_DIGITS[String(d)] ?? [];
      expect(g).toHaveLength(STAT_DIGIT_HEIGHT);
      expect(new Set(g.map((r) => r.length)).size).toBe(1);
    }
  });

  it.each([CARD_FACE.atk, CARD_FACE.hp])('centres 0–12 in the badge interior %o', (box) => {
    const cx = box.x + (box.w - 1) / 2;
    const cy = box.y + (box.h - 1) / 2;
    for (let v = 0; v <= 12; v++) {
      const b = bbox(statDigitPixels(v, box));
      // The glyph run's own width (bounding box) equals the planned run width.
      expect(b.x1 - b.x0 + 1, `width of ${String(v)}`).toBe(statRunWidth(v));
      const offX = (b.x0 + b.x1) / 2 - cx;
      const offY = (b.y0 + b.y1) / 2 - cy;
      // Exact where parity allows; otherwise ½ px left/up (the spare pixel goes right/down).
      const parityX = (box.w - statRunWidth(v)) % 2 === 0 ? 0 : -0.5;
      const parityY = (box.h - STAT_DIGIT_HEIGHT) % 2 === 0 ? 0 : -0.5;
      expect(offX, `x of ${String(v)}`).toBe(parityX);
      expect(offY, `y of ${String(v)}`).toBe(parityY);
      expect(Math.abs(offX)).toBeLessThanOrEqual(1);
      expect(Math.abs(offY)).toBeLessThanOrEqual(1);
    }
  });

  it('rejects values it cannot draw', () => {
    expect(() => statDigitPixels(-1, CARD_FACE.atk)).toThrow();
    expect(() => statDigitPixels(100, CARD_FACE.atk)).toThrow();
  });
});
