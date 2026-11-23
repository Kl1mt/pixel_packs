import { describe, expect, it } from 'vitest';
import { AbilitySchema, CardInstanceTraitsSchema, CardSchema } from '../model/card.js';
import { PackTypeSchema } from '../model/pack.js';
import { buildPlaceholderCatalog } from '../testing/placeholderCatalog.js';
import { buildCatalogIndex } from './catalog.js';
import { createSeededRng } from '../rng/rng.js';
import { revealOrder, rollPack } from './packRoll.js';
import { M1_INDEX } from './testUtils.js';
import { FRESH_PITY } from '../model/pack.js';
import { rarityRank } from '../model/enums.js';

describe('catalog index', () => {
  it('accepts a catalog that matches the composition', () => {
    const cards = buildPlaceholderCatalog(['mossgrove', 'starhollow']);
    expect(cards).toHaveLength(26);
    for (const c of cards) expect(CardSchema.safeParse(c).success).toBe(true);
    expect(M1_INDEX.byRealmRarity.get('mossgrove')?.get('common')).toHaveLength(4);
  });

  it('rejects missing cards, duplicates and ignores event cards', () => {
    const cards = buildPlaceholderCatalog(['mossgrove', 'starhollow']);
    const [first] = cards;
    if (!first) throw new Error('empty catalog');
    expect(() => buildCatalogIndex(cards.slice(1))).toThrow(/expected 4/);
    expect(() => buildCatalogIndex([...cards, first])).toThrow(/duplicate/);
    const event = { ...first, id: 'MOS-099', flags: { event: true, craftable: false } };
    expect(() => buildCatalogIndex([...cards, event])).not.toThrow();
  });

  it('refuses packs of a disabled realm', () => {
    expect(() =>
      rollPack({ kind: 'realm', realm: 'tidepool' }, FRESH_PITY, M1_INDEX, createSeededRng(1)),
    ).toThrow(/not enabled/);
  });
});

describe('schemas', () => {
  it('requires `every` exactly for support abilities', () => {
    const base = { effect: 'heal', target: 'front', value: 2 } as const;
    expect(AbilitySchema.safeParse({ ...base, trigger: 'support', every: 3 }).success).toBe(true);
    expect(AbilitySchema.safeParse({ ...base, trigger: 'support' }).success).toBe(false);
    expect(AbilitySchema.safeParse({ ...base, trigger: 'onHurt', every: 3 }).success).toBe(false);
  });

  it('parses card instance traits and pack types', () => {
    const traits = {
      variant: 'void',
      stars: 1,
      edition: { season: 1 },
      mintNumber: 12,
      source: 'pack',
      acquiredAt: '2026-11-23T10:00:00Z',
      tradeLockUntil: null,
      accountBound: false,
    };
    expect(CardInstanceTraitsSchema.parse(traits)).toEqual(traits);
    expect(CardInstanceTraitsSchema.safeParse({ ...traits, stars: 4 }).success).toBe(false);
    expect(PackTypeSchema.safeParse({ kind: 'realm', realm: 'skyloft' }).success).toBe(true);
    expect(PackTypeSchema.safeParse({ kind: 'realm' }).success).toBe(false);
  });
});

describe('reveal order', () => {
  it('reveals by ascending rarity with the featured slot last', () => {
    const rng = createSeededRng('reveal');
    for (let i = 0; i < 200; i++) {
      const order = revealOrder(rollPack({ kind: 'mythic' }, FRESH_PITY, M1_INDEX, rng).cards);
      expect(order[4]?.featured).toBe(true);
      const ranks = order.slice(0, 4).map((c) => rarityRank(c.rarity));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
});
