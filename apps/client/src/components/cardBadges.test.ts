import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARD_FACE, MASTER_PALETTE, VARIANTS } from '@pixel-packs/shared';
import { cardBadgePixels } from './cardBadges.js';
import { cardFaceModel } from './cardFace.js';

const PALETTE = new Set<string>(Object.values(MASTER_PALETTE));
const W = CARD_FACE.art;

describe('card badges (GDD §6)', () => {
  it('draws nothing for a plain ★1 copy', () => {
    expect(cardBadgePixels({ variant: 'foil', stars: 1, edition: null, mintNumber: null })).toEqual(
      [],
    );
  });

  it('keeps the largest badge set inside the art window, in palette colours, without overlap', () => {
    const left = cardBadgePixels({
      variant: 'normal',
      stars: 3,
      edition: { season: 9 },
      mintNumber: null,
    });
    const right = cardBadgePixels({
      variant: 'glitch',
      stars: 1,
      edition: null,
      mintNumber: 99999,
    });
    for (const p of [...left, ...right]) {
      expect(p.x).toBeGreaterThanOrEqual(W.x);
      expect(p.x).toBeLessThan(W.x + W.w);
      expect(p.y).toBeGreaterThanOrEqual(W.y);
      expect(PALETTE.has(p.colour)).toBe(true);
    }
    const leftMax = Math.max(...left.map((p) => p.x));
    const rightMin = Math.min(...right.map((p) => p.x));
    expect(leftMax).toBeLessThan(rightMin);
  });

  it('shows mint plates only for minted variants', () => {
    for (const variant of VARIANTS) {
      const px = cardBadgePixels({ variant, stars: 1, edition: null, mintNumber: 12 });
      expect(px.length > 0).toBe(variant === 'void' || variant === 'glitch');
    }
  });
});

describe('card face model with copy traits', () => {
  const card = CARD_CATALOG[0];
  if (!card) throw new Error('empty catalog');

  it('shows ★ stats and says variant, stars, edition and mint in the label', () => {
    const m = cardFaceModel(card, {
      variant: 'void',
      stars: 3,
      edition: { season: 1 },
      mintNumber: 7,
    });
    expect(m.atk).toBeGreaterThanOrEqual(card.atk);
    expect(m.hp).toBeGreaterThan(card.hp);
    expect(m.label).toContain('Void #7');
    expect(m.label).toContain('3 stars');
    expect(m.label).toContain('First Edition, Season 1');
  });

  it('defaults to a plain ★1 copy', () => {
    const m = cardFaceModel(card);
    expect(m).toMatchObject({
      variant: 'normal',
      stars: 1,
      atk: card.atk,
      hp: card.hp,
      badgePixels: [],
    });
    expect(m.crestPixels.length).toBeGreaterThan(0);
  });
});
