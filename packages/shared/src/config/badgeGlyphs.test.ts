import { describe, expect, it } from 'vitest';
import {
  BADGE_GLYPHS,
  BADGE_GLYPH_HEIGHT,
  badgeTextPixels,
  badgeTextWidth,
} from './badgeGlyphs.js';

describe('badge glyphs', () => {
  it('are 5 rows, each glyph of one width', () => {
    for (const rows of Object.values(BADGE_GLYPHS)) {
      expect(rows).toHaveLength(BADGE_GLYPH_HEIGHT);
      expect(new Set(rows.map((r) => r.length)).size).toBe(1);
    }
  });

  it('lays text out left to right with 1 px gaps', () => {
    expect(badgeTextWidth('#12')).toBe(13);
    expect(badgeTextWidth('1ST S1')).toBe(3 * 5 + 1 + 5);
    const px = badgeTextPixels('#1', 10, 20);
    expect(Math.min(...px.map((p) => p.x))).toBe(10);
    expect(Math.max(...px.map((p) => p.x))).toBe(10 + badgeTextWidth('#1') - 1);
    expect(Math.max(...px.map((p) => p.y))).toBe(24);
  });

  it('rejects characters it cannot draw', () => {
    expect(() => badgeTextWidth('x')).toThrow();
  });
});
