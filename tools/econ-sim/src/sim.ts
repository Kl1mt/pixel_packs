/** Economy simulator v0 (GDD §8): a free M1 player focusing on one realm. */
import {
  CRAFT_COST,
  FRESH_PITY,
  MAX_EQUIVALENTS,
  buildCatalogIndex,
  CARD_CATALOG,
  createSeededRng,
  dustValue,
  rollPack,
  type CatalogIndex,
  type Card,
  type PityCounters,
  type Realm,
  type Rng,
} from '@pixel-packs/shared';

export interface SimParams {
  days: number;
  players: number;
  seed: string;
  /** M1 sources: 3 free packs/day (8 h timer, always claimed) + the daily calendar. */
  freePacksPerDay: number;
  calendarGoldPerDay: number;
  packPriceGold: number;
  realm: Realm;
  enabledRealms: readonly Realm[];
}

export const DEFAULT_PARAMS: SimParams = {
  days: 90,
  players: 2000,
  seed: 'econ-sim-v0',
  freePacksPerDay: 3,
  calendarGoldPerDay: 50,
  packPriceGold: 100,
  realm: 'mossgrove',
  enabledRealms: ['mossgrove', 'starhollow'],
};

/** Day (1-based) a milestone was reached, or null if not within the simulated days. */
export interface PlayerResult {
  packs: number;
  nonMythicLuck: number | null;
  allLuck: number | null;
  nonMythicCraft: number | null;
  allCraft: number | null;
  dustAtDay21: number;
}

interface Collection {
  copies: Map<string, number>;
  dust: number;
}

function missing(realmCards: readonly Card[], have: (id: string) => boolean, withMythic: boolean) {
  return realmCards.filter((c) => (withMythic || c.rarity !== 'mythic') && !have(c.id));
}

/** Crafts missing cards, cheapest first, while dust allows (GDD §9). */
function craftMissing(col: Collection, realmCards: readonly Card[]): void {
  const todo = missing(realmCards, (id) => (col.copies.get(id) ?? 0) > 0, true).sort(
    (a, b) => CRAFT_COST[a.rarity] - CRAFT_COST[b.rarity],
  );
  for (const card of todo) {
    if (col.dust < CRAFT_COST[card.rarity]) break;
    col.dust -= CRAFT_COST[card.rarity];
    col.copies.set(card.id, 1);
  }
}

export function simulatePlayer(
  params: SimParams,
  index: CatalogIndex,
  realmCards: readonly Card[],
  rng: Rng,
): PlayerResult {
  const luck = new Set<string>();
  const craft: Collection = { copies: new Map(), dust: 0 };
  const result: PlayerResult = {
    packs: 0,
    nonMythicLuck: null,
    allLuck: null,
    nonMythicCraft: null,
    allCraft: null,
    dustAtDay21: 0,
  };
  let pity: PityCounters = FRESH_PITY;
  let gold = 0;
  const pack = { kind: 'realm', realm: params.realm } as const;

  for (let day = 1; day <= params.days; day++) {
    gold += params.calendarGoldPerDay;
    const bought = Math.floor(gold / params.packPriceGold);
    gold -= bought * params.packPriceGold;
    for (let i = 0; i < params.freePacksPerDay + bought; i++) {
      const roll = rollPack(pack, pity, index, rng);
      pity = roll.pity;
      result.packs++;
      for (const c of roll.cards) {
        luck.add(c.cardId);
        const n = (craft.copies.get(c.cardId) ?? 0) + 1;
        // "Dust extras": Normal copies beyond 9 ★1-equivalents.
        if (n > MAX_EQUIVALENTS && c.variant === 'normal') {
          craft.dust += dustValue(c.rarity, 'normal');
        } else {
          craft.copies.set(c.cardId, n);
        }
      }
    }
    craftMissing(craft, realmCards);
    if (day === 21) result.dustAtDay21 = craft.dust;

    const hasLuck = (id: string) => luck.has(id);
    const hasCraft = (id: string) => (craft.copies.get(id) ?? 0) > 0;
    result.nonMythicLuck ??= missing(realmCards, hasLuck, false).length === 0 ? day : null;
    result.allLuck ??= missing(realmCards, hasLuck, true).length === 0 ? day : null;
    result.nonMythicCraft ??= missing(realmCards, hasCraft, false).length === 0 ? day : null;
    result.allCraft ??= missing(realmCards, hasCraft, true).length === 0 ? day : null;
  }
  return result;
}

export function simulate(params: SimParams): PlayerResult[] {
  const catalog = CARD_CATALOG.filter((c) => params.enabledRealms.includes(c.realm));
  const index = buildCatalogIndex(catalog, params.enabledRealms);
  const realmCards = catalog.filter((c) => c.realm === params.realm && !c.flags.event);
  const rng = createSeededRng(params.seed);
  return Array.from({ length: params.players }, () =>
    simulatePlayer(params, index, realmCards, rng),
  );
}
