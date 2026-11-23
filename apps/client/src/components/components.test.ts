import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARD_FACE, MASTER_PALETTE, statDigitPixels } from '@pixel-packs/shared';
import { MAX_NAV_ITEMS, NAV_ITEMS } from '../shell/nav.js';
import { cardFaceModel } from './cardFace.js';
import { formatAmount } from './CurrencyBadge.js';

describe('card face model', () => {
  it('builds every catalog card: frame, art, bottom-aligned drop, name size, label', () => {
    for (const c of CARD_CATALOG) {
      const m = cardFaceModel(c);
      expect(m.frame).toBe(`/assets/frames/${c.rarity}.png`);
      expect(m.art).toBe(`/assets/cards/${c.id}.png`);
      expect(m.artDrop).toBeGreaterThanOrEqual(0);
      expect(m.artDrop).toBeLessThan(CARD_FACE.art.h);
      expect([16, 18, 20]).toContain(m.nameSize);
      expect(m.label).toContain(`attack ${String(c.atk)}, health ${String(c.hp)}`);
    }
  });

  it('draws ATK/HP with the shared chunky digits and honours overrides', () => {
    const c = CARD_CATALOG.find((x) => x.id === 'MOS-012');
    if (!c) throw new Error('missing MOS-012');
    const m = cardFaceModel(c, { rarity: 'mythic', atk: 12, hp: 0 });
    expect(m.frame).toBe('/assets/frames/mythic.png');
    expect(m.statPixels).toEqual([
      ...statDigitPixels(12, CARD_FACE.atk),
      ...statDigitPixels(0, CARD_FACE.hp),
    ]);
    expect(m.backdrop).toEqual([MASTER_PALETTE.lichen, MASTER_PALETTE.sprout]);
  });
});

describe('currency badge', () => {
  it('shows plain digits, and a dash while unknown', () => {
    expect(formatAmount(1240)).toBe('1240');
    expect(formatAmount(12.9)).toBe('12');
    expect(formatAmount(-3)).toBe('0');
    expect(formatAmount(null)).toBe('–');
  });
});

describe('navigation', () => {
  it('has Home · Packs · Binder and stays within the 5-item limit', () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual(['Home', 'Packs', 'Binder']);
    expect(NAV_ITEMS.length).toBeLessThanOrEqual(MAX_NAV_ITEMS);
  });
});
