import { ENABLED_REALMS, REALM_COMPOSITION } from '../config/odds.js';
import type { Card } from '../model/card.js';
import { RARITIES, type Rarity, type Realm } from '../model/enums.js';

/** Cards grouped for rolling: `byRealmRarity[realm][rarity]` lists rollable card ids. */
export interface CatalogIndex {
  readonly enabledRealms: readonly Realm[];
  readonly byId: ReadonlyMap<string, Card>;
  readonly byRealmRarity: ReadonlyMap<Realm, ReadonlyMap<Rarity, readonly string[]>>;
}

/**
 * Indexes the pack pool: non-event cards of the enabled realms.
 * Throws if an enabled realm doesn't match `REALM_COMPOSITION`, so every roll can find a card.
 */
export function buildCatalogIndex(
  cards: readonly Card[],
  enabledRealms: readonly Realm[] = ENABLED_REALMS,
): CatalogIndex {
  const byId = new Map<string, Card>();
  const byRealmRarity = new Map<Realm, Map<Rarity, string[]>>();
  for (const realm of enabledRealms) {
    byRealmRarity.set(realm, new Map(RARITIES.map((r) => [r, []])));
  }
  for (const card of cards) {
    if (byId.has(card.id)) throw new Error(`duplicate card id ${card.id}`);
    byId.set(card.id, card);
    if (card.flags.event) continue;
    byRealmRarity.get(card.realm)?.get(card.rarity)?.push(card.id);
  }
  for (const [realm, rarities] of byRealmRarity) {
    for (const rarity of RARITIES) {
      const n = rarities.get(rarity)?.length ?? 0;
      if (n !== REALM_COMPOSITION[rarity]) {
        throw new Error(
          `realm ${realm} has ${n} ${rarity} cards, expected ${REALM_COMPOSITION[rarity]}`,
        );
      }
    }
  }
  return { enabledRealms: [...enabledRealms], byId, byRealmRarity };
}

export function cardsOf(index: CatalogIndex, realm: Realm, rarity: Rarity): readonly string[] {
  const ids = index.byRealmRarity.get(realm)?.get(rarity);
  if (!ids || ids.length === 0) throw new Error(`no ${rarity} cards in realm ${realm}`);
  return ids;
}
