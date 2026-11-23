import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARD_FACE, statDigitPixels } from '@pixel-packs/shared';
import { nameSize, styleTileHtml } from './html.js';

describe('style tile', () => {
  it('sizes card names so the longest still gets the 16 px floor, never less', () => {
    const sizes = CARD_CATALOG.map((c) => nameSize(c.name));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
    const longest = [...CARD_CATALOG].sort((a, b) => b.name.length - a.name.length)[0];
    expect(longest && nameSize(longest.name)).toBe(16);
  });

  it('draws ATK/HP as chunky pixel digits and no longer shows the badge comparison', () => {
    const html = styleTileHtml({ artDrop: {}, packPicks: { mossgrove: 5, starhollow: 6 } });
    const { atk } = CARD_FACE;
    const atkPixels = statDigitPixels(3, atk);
    const first = atkPixels[0];
    expect(first && html.includes(`<rect x="${String(first.x)}" y="${String(first.y)}"`)).toBe(
      true,
    );
    expect(html).toContain('attack 3, health 9');
    expect(html).not.toContain('badge variants');
    expect(html).toContain('Mossgrove #5, Starhollow #6');
  });
});
