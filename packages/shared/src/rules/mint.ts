import type { Variant } from '../model/enums.js';

/** Variants whose copies carry a global mint number per (card, variant) (GDD §6). */
export const MINTED_VARIANTS: readonly Variant[] = ['void', 'glitch'];

export function needsMintNumber(variant: Variant): boolean {
  return MINTED_VARIANTS.includes(variant);
}

/**
 * Hands out mint numbers. The server implements it in T10: numbers start at 1, are
 * assigned in the same transaction as the pull, and are never reused.
 */
export interface MintNumberAllocator {
  next(cardId: string, variant: Variant): Promise<number>;
}
