import { describe, expect, it } from 'vitest';
import { HEADING_FONT, MASTER_PALETTE, UI_SCALE } from '@pixel-packs/shared';
import { ROLES, SHADOWS, SPACE, TYPE, tokenCss } from './tokens.js';

describe('design tokens (GDD §16)', () => {
  const css = tokenCss();

  it('uses only master-palette colours', () => {
    const palette = new Set(Object.values(MASTER_PALETTE).map((h) => h.toLowerCase()));
    const hexes = css.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    for (const h of hexes) expect(palette.has(h.toLowerCase())).toBe(true);
    for (const role of Object.values(ROLES)) expect(MASTER_PALETTE[role]).toBeDefined();
    expect(css).not.toMatch(/rgba?\(|hsla?\(/);
  });

  it('keeps to four text sizes, pixel font at whole multiples of its glyph, body ≥ 16 px', () => {
    expect(Object.keys(TYPE)).toHaveLength(4);
    for (const t of Object.values(TYPE)) {
      if (t.font === 'heading') expect(t.size % HEADING_FONT.glyphPx).toBe(0);
      else expect(t.size).toBeGreaterThanOrEqual(16);
    }
  });

  it('scales lengths by the integer UI scale and keeps shadows hard and 2–4 px', () => {
    expect(Number.isInteger(UI_SCALE)).toBe(true);
    expect(css).toContain(`--sp-4: ${String(4 * UI_SCALE)}px;`);
    expect(SPACE.every((n) => Number.isInteger(n))).toBe(true);
    for (const s of Object.values(SHADOWS)) {
      const [x, y, blur] = s.split(' ');
      expect(blur).toBe('0');
      for (const v of [x, y]) {
        const n = Number.parseInt(v ?? '', 10);
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(4);
      }
    }
  });

  it('builds 9-slice panels and all four button states', () => {
    expect(css).toContain('.panel--parchment { border-image: url(');
    expect(css).toContain('.panel--wood { border-image: url(');
    for (const s of ['rest', 'hover', 'pressed', 'disabled']) {
      expect(css).toContain(`/assets/ui/button-${s}.png`);
    }
  });
});
