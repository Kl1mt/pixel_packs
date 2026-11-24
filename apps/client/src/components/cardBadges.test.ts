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
    const left = cardBadgePixels({ variant: 'normal', stars: 3, edition: null, mintNumber: null });
    const stamp = cardBadgePixels({
      variant: 'normal',
      stars: 1,
      edition: { season: 9 },
      mintNumber: null,
    });
    const right = cardBadgePixels({
      variant: 'glitch',
      stars: 1,
      edition: null,
      mintNumber: 99999,
    });
    for (const p of [...left, ...right, ...stamp]) {
      expect(p.x).toBeGreaterThanOrEqual(W.x);
      expect(p.x).toBeLessThan(W.x + W.w);
      expect(p.y).toBeGreaterThanOrEqual(W.y);
      expect(p.y).toBeLessThan(W.y + W.h);
      expect(PALETTE.has(p.colour)).toBe(true);
    }
    const leftMax = Math.max(...left.map((p) => p.x));
    const rightMin = Math.min(...right.map((p) => p.x));
    expect(leftMax).toBeLessThan(rightMin);
  });

  it('puts the First-Edition stamp bottom-right, smaller than a plate, clear of stars and mint (T22)', () => {
    const stamp = cardBadgePixels({
      variant: 'normal',
      stars: 1,
      edition: { season: 1 },
      mintNumber: null,
    });
    const xs = stamp.map((p) => p.x);
    const ys = stamp.map((p) => p.y);
    // 2 px inside the art window's bottom-right corner.
    expect(Math.max(...xs)).toBe(W.x + W.w - 3);
    expect(Math.max(...ys)).toBe(W.y + W.h - 3);
    // 24×8 (was a 25×9 plate).
    expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(24);
    expect(Math.max(...ys) - Math.min(...ys) + 1).toBe(8);
    const top = cardBadgePixels({ variant: 'void', stars: 3, edition: null, mintNumber: 99999 });
    // The stars and the mint plate stay in the top rows, well above the stamp.
    expect(Math.max(...top.map((p) => p.y))).toBeLessThan(Math.min(...ys));
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

  it('never covers the realm crest (T20), whatever the badges', () => {
    const crest = new Set(
      cardFaceModel(card).crestPixels.map((p) => `${String(p.x)},${String(p.y)}`),
    );
    for (const variant of VARIANTS)
      for (const stars of [1, 2, 3] as const) {
        const px = cardBadgePixels({ variant, stars, edition: { season: 9 }, mintNumber: 9999 });
        expect(px.filter((p) => crest.has(`${String(p.x)},${String(p.y)}`))).toEqual([]);
      }
  });
});
