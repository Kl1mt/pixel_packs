import { describe, expect, it } from 'vitest';
import { CARD_FACE } from '../config/cardFace.js';
import { statRunWidth } from '../config/statDigits.js';
import { CARD_CATALOG } from '../data/cards/index.js';
import { starScaled, starredCard } from './stars.js';

describe('star scaling (GDD §4)', () => {
  it('adds 30 % / 60 %, rounded half up', () => {
    expect([1, 2, 3, 4, 5, 10].map((v) => starScaled(v, 1))).toEqual([1, 2, 3, 4, 5, 10]);
    expect([1, 2, 3, 4, 5, 10].map((v) => starScaled(v, 2))).toEqual([1, 3, 4, 5, 7, 13]);
    expect([1, 2, 3, 4, 5, 10].map((v) => starScaled(v, 3))).toEqual([2, 3, 5, 6, 8, 16]);
    expect(starScaled(0, 3)).toBe(0);
  });

  it('scales stats and ability values but not support cadence', () => {
    for (const card of CARD_CATALOG) {
      expect(starredCard(card, 1)).toBe(card);
      const s3 = starredCard(card, 3);
      expect(s3.atk).toBe(starScaled(card.atk, 3));
      expect(s3.hp).toBeGreaterThan(card.hp);
      s3.abilities.forEach((a, i) => {
        expect(a.value).toBe(starScaled(card.abilities[i]?.value ?? 0, 3));
        expect(a.every).toBe(card.abilities[i]?.every);
      });
    }
  });

  it('keeps every ★3 catalog stat inside its badge', () => {
    for (const card of CARD_CATALOG) {
      const s3 = starredCard(card, 3);
      expect(statRunWidth(s3.atk)).toBeLessThanOrEqual(CARD_FACE.atk.w);
      expect(statRunWidth(s3.hp)).toBeLessThanOrEqual(CARD_FACE.hp.w);
    }
  });
});
