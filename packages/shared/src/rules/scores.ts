import type { Rarity, Variant } from '../model/enums.js';
import type { Stars } from '../model/card.js';

/** Pull score (GDD §15). */
export const PULL_RARITY_POINTS: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 3,
  rare: 10,
  epic: 40,
  legendary: 150,
  mythic: 600,
};
export const PULL_VARIANT_MULTIPLIER: Readonly<Record<Variant, number>> = {
  normal: 1,
  foil: 2,
  prismatic: 6,
  void: 15,
  glitch: 40,
};

export function pullScore(rarity: Rarity, variant: Variant): number {
  return PULL_RARITY_POINTS[rarity] * PULL_VARIANT_MULTIPLIER[variant];
}

export interface OwnedCopy {
  cardId: string;
  rarity: Rarity;
  variant: Variant;
  stars: Stars;
}

/**
 * Collection score (GDD §15): the pull score of each distinct (card, variant) owned,
 * +50 % for an entry with a ★3 copy (rounded half up per entry, so the score is an integer).
 */
export function collectionScore(copies: Iterable<OwnedCopy>): number {
  const entries = new Map<string, { score: number; star3: boolean }>();
  for (const c of copies) {
    const key = `${c.cardId}|${c.variant}`;
    const e = entries.get(key) ?? { score: pullScore(c.rarity, c.variant), star3: false };
    e.star3 ||= c.stars === 3;
    entries.set(key, e);
  }
  let total = 0;
  for (const e of entries.values()) total += e.star3 ? Math.round(e.score * 1.5) : e.score;
  return total;
}
