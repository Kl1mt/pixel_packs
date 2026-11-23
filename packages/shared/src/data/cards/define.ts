import type { Ability, Card } from '../../model/card.js';
import { REALM_CODES, type Rarity, type Realm } from '../../model/enums.js';

/** Card fields an author writes; id, set, realm and flags are filled in. */
export interface CardDraft {
  n: number;
  name: string;
  rarity: Rarity;
  atk: number;
  hp: number;
  abilities: Ability[];
  flavour: string;
  artPrompt: string;
}

export const SET_ID = 'set1';

export function defineRealmCards(realm: Realm, drafts: readonly CardDraft[]): Card[] {
  return drafts.map(({ n, ...draft }) => ({
    id: `${REALM_CODES[realm]}-${String(n).padStart(3, '0')}`,
    set: SET_ID,
    realm,
    ...draft,
    flags: { event: false, craftable: true },
  }));
}
