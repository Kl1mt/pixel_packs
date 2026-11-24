import { describe, expect, it } from 'vitest';
import { CARD_CATALOG } from '../data/cards/index.js';
import { STARTER_CARDS, checkAdvance, grantsStarterCards } from './onboarding.js';

describe('onboarding', () => {
  const fresh = { scriptedPacksOpened: 0, realmPacksOwned: 2 };
  const opened = { scriptedPacksOpened: 2, realmPacksOwned: 1 };

  it('moves one stage at a time and never skips (T22)', () => {
    expect(checkAdvance('courier', 'packs', fresh)).toBe('ok');
    expect(checkAdvance('courier', 'tour', fresh)).toBe('skip');
    expect(checkAdvance('courier', 'done', fresh)).toBe('skip');
    expect(checkAdvance('tour', 'starter', opened)).toBe('ok');
    expect(checkAdvance('starter', 'done', opened)).toBe('ok');
  });

  it('treats the current or an earlier stage as a retry', () => {
    expect(checkAdvance('packs', 'packs', fresh)).toBe('noop');
    expect(checkAdvance('tour', 'packs', opened)).toBe('noop');
    expect(checkAdvance('done', 'courier', opened)).toBe('noop');
  });

  it('leaves the packs only once both scripted packs are open', () => {
    expect(checkAdvance('packs', 'tour', fresh)).toBe('packsFirst');
    expect(checkAdvance('packs', 'tour', { scriptedPacksOpened: 1, realmPacksOwned: 1 })).toBe(
      'packsFirst',
    );
    expect(checkAdvance('packs', 'tour', opened)).toBe('ok');
    // An empty satchel cannot trap the player.
    expect(checkAdvance('packs', 'tour', { scriptedPacksOpened: 1, realmPacksOwned: 0 })).toBe(
      'ok',
    );
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
