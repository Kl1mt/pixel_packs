import { REALM_COMPOSITION } from '../config/odds.js';
import type { Card } from '../model/card.js';
import { RARITIES, REALM_CODES, type Realm } from '../model/enums.js';

/**
 * Stand-in catalog that matches `REALM_COMPOSITION` (ids numbered by rarity), for tests
 * and `tools/econ-sim` until the real set lands (T03).
 */
export function buildPlaceholderCatalog(realms: readonly Realm[]): Card[] {
  const cards: Card[] = [];
  for (const realm of realms) {
    let n = 0;
    for (const rarity of RARITIES) {
      for (let i = 0; i < REALM_COMPOSITION[rarity]; i++) {
        n++;
        const id = `${REALM_CODES[realm]}-${String(n).padStart(3, '0')}`;
        cards.push({
          id,
          set: 'set1',
          name: `${realm} ${rarity} ${i + 1}`,
          realm,
          rarity,
          atk: 4,
          hp: 4,
          abilities: [{ trigger: 'onEnter', effect: 'buffHp', target: 'self', value: 1 }],
          flavour: 'Placeholder.',
          artPrompt: 'placeholder critter',
          flags: { event: false, craftable: true },
        });
      }
    }
  }
  return cards;
}
