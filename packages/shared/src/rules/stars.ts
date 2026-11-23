import type { Card, Stars } from '../model/card.js';

/** Star bonus to stats and ability values (GDD §4): ★2 = +30 %, ★3 = +60 %. */
export const STAR_BONUS: Readonly<Record<Stars, number>> = { 1: 0, 2: 0.3, 3: 0.6 };

/** `value` raised by the star bonus, rounded half up (integer maths, no float drift). */
export function starScaled(value: number, stars: Stars): number {
  const tenths = Math.round(STAR_BONUS[stars] * 10);
  return Math.floor((value * (10 + tenths) + 5) / 10);
}

/**
 * The card as a ★`stars` copy plays: ATK, HP and every ability `value` scaled.
 * `every` (support cadence in ticks) is a timing, not a value, and stays as is.
 */
export function starredCard(card: Card, stars: Stars): Card {
  if (stars === 1) return card;
  return {
    ...card,
    atk: starScaled(card.atk, stars),
    hp: starScaled(card.hp, stars),
    abilities: card.abilities.map((a) => ({ ...a, value: starScaled(a.value, stars) })),
  };
}
