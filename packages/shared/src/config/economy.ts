/**
 * Economy constants for M1 (GDD §7, §8). The server is authoritative; the client only
 * displays these. `tools/econ-sim` reads the same numbers.
 */

/** Pack prices (GDD §7). Realm packs cost gold, the Mythic pack gems. */
export const PACK_PRICES = {
  realm: { currency: 'gold', amount: 100 },
  mythic: { currency: 'gems', amount: 300 },
} as const satisfies Record<string, { currency: 'gold' | 'gems'; amount: number }>;

/** Most packs one purchase may buy. */
export const MAX_PACKS_PER_PURCHASE = 10;

const HOUR_MS = 60 * 60 * 1000;

/** Free pack (GDD §7): one every 8 h, up to 2 stored. */
export const FREE_PACK_INTERVAL_MS = 8 * HOUR_MS;
export const FREE_PACK_MAX_STORED = 2;
/** Free packs ready on a brand-new account. */
export const FREE_PACK_STORED_AT_START = 1;

/** One day of the 7-day calendar. Missed days pause the cycle, they never reset it. */
export interface CalendarReward {
  gold: number;
  dust: number;
}

/**
 * Daily calendar (GDD §8): 350 gold + 150 Stardust per 7 days, i.e. 50 gold/day on
 * average, which the M1 econ-sim assumes (≈ 3.5 packs/day with the free packs).
 */
export const CALENDAR_REWARDS: readonly CalendarReward[] = [
  { gold: 40, dust: 0 },
  { gold: 50, dust: 0 },
  { gold: 0, dust: 50 },
  { gold: 60, dust: 0 },
  { gold: 70, dust: 0 },
  { gold: 0, dust: 100 },
  { gold: 130, dust: 0 },
];

/** Packs in the starter satchel every new account receives (GDD §17: the two scripted packs). */
export const STARTER_PACKS = ['mossgrove', 'starhollow'] as const;
