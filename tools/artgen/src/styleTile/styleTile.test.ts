import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARD_FACE } from '@pixel-packs/shared';
import { nameSize, styleTileHtml } from './html.js';

describe('style tile', () => {
  it('sizes card names so the longest still gets the 16 px floor, never less', () => {
    const sizes = CARD_CATALOG.map((c) => nameSize(c.name));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
    const longest = [...CARD_CATALOG].sort((a, b) => b.name.length - a.name.length)[0];
    expect(longest && nameSize(longest.name)).toBe(16);
  });

  it('positions the card stats on the CARD_FACE badge rects', () => {
    const html = styleTileHtml({ artDrop: {}, packPicks: { mossgrove: 5, starhollow: 6 } });
    const { atk } = CARD_FACE;
    expect(html).toContain(
      `left:calc(${String(atk.x)}px * var(--card));top:calc(${String(atk.y)}px * var(--card))`,
    );
    expect(html).toContain('Mossgrove #5, Starhollow #6');
  });
});
