import { describe, expect, it } from 'vitest';
import { ENABLED_REALMS, REALM_COMPOSITION } from '../../config/odds.js';
import { POWER_BUDGET } from '../../config/power.js';
import { CardSchema } from '../../model/card.js';
import { RARITIES, REALM_CODES, rarityRank } from '../../model/enums.js';
import { buildCatalogIndex } from '../../rules/catalog.js';
import { cardRulesText, isAbilityTargetValid } from '../../rules/rulesText.js';
import { CARD_CATALOG, SET_ID } from './index.js';

describe('card catalog (set 1, M1 realms)', () => {
  it('has 13 cards for each enabled realm and passes the pack-pool index', () => {
    expect(CARD_CATALOG).toHaveLength(13 * ENABLED_REALMS.length);
    const index = buildCatalogIndex(CARD_CATALOG, ENABLED_REALMS);
    expect(index.byId.size).toBe(CARD_CATALOG.length);
  });

  it('parses every card with the Zod schema', () => {
    for (const card of CARD_CATALOG) expect(() => CardSchema.parse(card)).not.toThrow();
  });

  it('numbers ids by rarity within each realm, starting at 001', () => {
    for (const realm of ENABLED_REALMS) {
      const cards = CARD_CATALOG.filter((c) => c.realm === realm);
      const expectedRarities = RARITIES.flatMap((r) =>
        Array.from({ length: REALM_COMPOSITION[r] }, () => r),
      );
      cards.forEach((card, i) => {
        expect(card.id).toBe(`${REALM_CODES[realm]}-${String(i + 1).padStart(3, '0')}`);
        expect(card.rarity).toBe(expectedRarities[i]);
      });
      const ranks = cards.map((c) => rarityRank(c.rarity));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('has unique names and the set id', () => {
    expect(new Set(CARD_CATALOG.map((c) => c.name)).size).toBe(CARD_CATALOG.length);
    for (const card of CARD_CATALOG) expect(card.set).toBe(SET_ID);
  });

  it('spends exactly the power budget on ATK + HP', () => {
    for (const card of CARD_CATALOG) {
      expect(card.atk + card.hp, card.id).toBe(POWER_BUDGET[card.rarity]);
    }
  });

  it('has valid ability targets and generated rules text', () => {
    for (const card of CARD_CATALOG) {
      for (const ability of card.abilities)
        expect(isAbilityTargetValid(ability), card.id).toBe(true);
      expect(cardRulesText(card)).toHaveLength(card.abilities.length);
    }
  });

  it('has flavour text and an art prompt without style words', () => {
    const styleWords = /pixel|outline|shading|background|frame|style|8-bit|16-bit/i;
    for (const card of CARD_CATALOG) {
      expect(card.flavour.length, card.id).toBeGreaterThan(0);
      expect(card.flavour.length, card.id).toBeLessThanOrEqual(90);
      expect(card.artPrompt.trim().length, card.id).toBeGreaterThan(20);
      expect(card.artPrompt, card.id).not.toMatch(styleWords);
    }
  });

  it('keeps every card craftable and out of events', () => {
    for (const card of CARD_CATALOG) expect(card.flags).toEqual({ event: false, craftable: true });
  });
});
