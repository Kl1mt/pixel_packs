import { describe, expect, it } from 'vitest';
import type { CollectionCopy } from '../api/collection.js';
import { CARD_CATALOG } from '../data/cards/index.js';
import {
  DEFAULT_BINDER_FILTER,
  binderPages,
  binderSlots,
  checkDust,
  compareCopies,
  isFiltered,
  isMaxed,
  realmCompletion,
  stacksByCard,
  type BinderFilter,
} from './binder.js';

let n = 0;
function copy(cardId: string, o: Partial<CollectionCopy> = {}): CollectionCopy {
  n += 1;
  return {
    userCardId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    cardId,
    variant: 'normal',
    stars: 1,
    edition: null,
    mintNumber: null,
    source: 'pack',
    acquiredAt: `2026-11-${String(10 + (n % 10)).padStart(2, '0')}T00:00:00.000Z`,
    tradeLockUntil: null,
    accountBound: false,
    ...o,
  };
}

const filter = (o: Partial<BinderFilter>): BinderFilter => ({ ...DEFAULT_BINDER_FILTER, ...o });
const ids = (slots: { card: { id: string } }[]) => slots.map((s) => s.card.id);

describe('stacks', () => {
  it('groups copies per card, best copy first', () => {
    const plain = copy('MOS-001');
    const starred = copy('MOS-001', { stars: 2 });
    const foil = copy('MOS-001', { variant: 'foil' });
    const voidHigh = copy('MOS-001', { variant: 'void', mintNumber: 9 });
    const voidLow = copy('MOS-001', { variant: 'void', mintNumber: 3 });
    const stacks = stacksByCard([plain, starred, foil, voidHigh, voidLow, copy('STA-001')]);
    expect(stacks.get('MOS-001')?.map((c) => c.userCardId)).toEqual(
      [voidLow, voidHigh, foil, starred, plain].map((c) => c.userCardId),
    );
    expect(stacks.get('STA-001')).toHaveLength(1);
  });

  it('prefers a First-Edition stamp, then the older copy', () => {
    const old = copy('MOS-001', { acquiredAt: '2026-01-01T00:00:00.000Z' });
    const young = copy('MOS-001', { acquiredAt: '2026-02-01T00:00:00.000Z' });
    const stamped = copy('MOS-001', { edition: { season: 1 } });
    expect([young, old, stamped].sort(compareCopies)).toEqual([stamped, old, young]);
  });

  it('is maxed at 9 ★1-equivalents', () => {
    expect(isMaxed([copy('MOS-001', { stars: 3 })])).toBe(true);
    expect(isMaxed([copy('MOS-001', { stars: 2 }), copy('MOS-001', { stars: 2 })])).toBe(false);
  });
});

describe('binder slots', () => {
  const stacks = stacksByCard([
    copy('MOS-001'),
    copy('MOS-001'),
    copy('MOS-002', { variant: 'glitch', mintNumber: 1 }),
    copy('MOS-003', { stars: 2, edition: { season: 1 } }),
    copy('STA-001'),
  ]);

  it('lists every card of the realm in number order, owned or not', () => {
    const slots = binderSlots(CARD_CATALOG, 'mossgrove', stacks);
    expect(slots).toHaveLength(13);
    expect(ids(slots).slice(0, 3)).toEqual(['MOS-001', 'MOS-002', 'MOS-003']);
    expect(slots[0]?.copies).toHaveLength(2);
    expect(slots[3]?.copies).toHaveLength(0);
  });

  it('filters by owned, missing, variant, stars, edition and minted', () => {
    const of = (o: Partial<BinderFilter>) =>
      ids(binderSlots(CARD_CATALOG, 'mossgrove', stacks, filter(o)));
    expect(of({ owned: 'owned' })).toEqual(['MOS-001', 'MOS-002', 'MOS-003']);
    expect(of({ owned: 'missing' })).toHaveLength(10);
    expect(of({ variant: 'glitch' })).toEqual(['MOS-002']);
    expect(of({ stars: 2 })).toEqual(['MOS-003']);
    expect(of({ edition: true })).toEqual(['MOS-003']);
    expect(of({ minted: true })).toEqual(['MOS-002']);
    expect(of({ owned: 'missing', minted: true })).toEqual([]);
  });

  it('filters by rarity', () => {
    const slots = binderSlots(CARD_CATALOG, 'starhollow', stacks, filter({ rarity: 'mythic' }));
    expect(slots.every((s) => s.card.rarity === 'mythic')).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('sorts by rarity, name, count and newest, ties in number order', () => {
    const sorted = (s: Parameters<typeof binderSlots>[4]) =>
      binderSlots(CARD_CATALOG, 'mossgrove', stacks, DEFAULT_BINDER_FILTER, s);
    const byRarity = sorted('rarity');
    expect(byRarity[0]?.card.rarity).toBe('mythic');
    const names = sorted('name').map((s) => s.card.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(sorted('count')[0]?.card.id).toBe('MOS-001');
    expect(sorted('newest').slice(-1)[0]?.copies).toHaveLength(0);
  });

  it('knows when a filter is set', () => {
    expect(isFiltered(DEFAULT_BINDER_FILTER)).toBe(false);
    expect(isFiltered(filter({ minted: true }))).toBe(true);
  });

  it('pages in nines and counts completion', () => {
    const pages = binderPages(binderSlots(CARD_CATALOG, 'mossgrove', stacks));
    expect(pages.map((p) => p.length)).toEqual([9, 4]);
    expect(binderPages([])).toEqual([[]]);
    expect(realmCompletion(CARD_CATALOG, 'mossgrove', stacks)).toEqual({ owned: 3, total: 13 });
  });
});

describe('dust safety', () => {
  const card = { rarity: 'rare' as const };
  it('warns about variants, mint numbers, stamps, stars and the last copy', () => {
    const special = copy('MOS-001', {
      variant: 'void',
      mintNumber: 4,
      edition: { season: 1 },
      stars: 2,
    });
    const plain = copy('MOS-001');
    const all = checkDust(card, [special, plain], new Set([special.userCardId, plain.userCardId]));
    expect(all.warnings).toEqual(['variant', 'mint', 'edition', 'stars', 'lastCopy']);
    expect(all.dust).toBe(50 * 25 * 3 + 50);
    const one = checkDust(card, [special, plain], new Set([plain.userCardId]));
    expect(one.warnings).toEqual([]);
    expect(one.dustable).toEqual([plain.userCardId]);
  });

  it('never dusts account-bound copies', () => {
    const starter = copy('MOS-001', { accountBound: true, source: 'starter' });
    const plain = copy('MOS-001');
    const r = checkDust(card, [starter, plain], new Set([starter.userCardId, plain.userCardId]));
    expect(r.blocked).toEqual([starter.userCardId]);
    expect(r.dustable).toEqual([plain.userCardId]);
    // The starter stays, so this is not the last copy.
    expect(r.warnings).toEqual([]);
  });
});
