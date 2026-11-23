import { describe, expect, it } from 'vitest';
import { CARD_CATALOG } from '../data/cards/index.js';
import { STARTER_CARDS, advanceStage, grantsStarterCards } from './onboarding.js';

describe('onboarding', () => {
  it('only moves forward', () => {
    expect(advanceStage('courier', 'tour')).toBe('tour');
    expect(advanceStage('tour', 'packs')).toBe('tour');
    expect(advanceStage('done', 'courier')).toBe('done');
    expect(advanceStage('packs', 'packs')).toBe('packs');
  });

  it('grants the starter cards from the starter stage on', () => {
    expect(grantsStarterCards('tour')).toBe(false);
    expect(grantsStarterCards('starter')).toBe(true);
    expect(grantsStarterCards('done')).toBe(true);
  });

  it('starter cards are five distinct catalog commons, a full caravan', () => {
    expect(STARTER_CARDS).toHaveLength(5);
    expect(new Set(STARTER_CARDS).size).toBe(5);
    for (const id of STARTER_CARDS) {
      const card = CARD_CATALOG.find((c) => c.id === id);
      expect(card?.rarity).toBe('common');
    }
  });
});
