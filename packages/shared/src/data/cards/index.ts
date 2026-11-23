import type { Card } from '../../model/card.js';
import { MOSSGROVE_CARDS } from './mossgrove.js';
import { STARHOLLOW_CARDS } from './starhollow.js';

export { SET_ID } from './define.js';
export { MOSSGROVE_CARDS, STARHOLLOW_CARDS };

/** Every catalog card, in realm order then id order. */
export const CARD_CATALOG: readonly Card[] = [...MOSSGROVE_CARDS, ...STARHOLLOW_CARDS];
