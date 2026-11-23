import type { Stars } from '../model/card.js';
import type { Rarity, Variant } from '../model/enums.js';
import { MAX_EQUIVALENTS, dustValue, starEquivalents } from './dust.js';

/** The traits of an owned copy that dusting cares about. */
export interface DustableCopy {
  id: string;
  cardId: string;
  rarity: Rarity;
  variant: Variant;
  stars: Stars;
  editionSeason: number | null;
  mintNumber: number | null;
  accountBound: boolean;
}

/** Account-bound (starter) copies can never be dusted. */
export function canDust(copy: DustableCopy): boolean {
  return !copy.accountBound;
}

/** A Normal copy with no stamp, no mint number and no binding: the only kind "Dust extras" touches. */
export function isPlainCopy(copy: DustableCopy): boolean {
  return (
    copy.variant === 'normal' &&
    copy.editionSeason === null &&
    copy.mintNumber === null &&
    !copy.accountBound
  );
}

export interface DustPlan {
  copyIds: string[];
  dust: number;
}

/**
 * "Dust extras" (GDD §9): per card, every copy counts towards the 9 ★1-equivalents of a
 * maxed card, and only plain copies beyond that are dusted, lowest stars first, so the
 * player keeps the copies closest to ★3 and every special copy.
 */
export function planDustExtras(copies: readonly DustableCopy[]): DustPlan {
  const byCard = new Map<string, DustableCopy[]>();
  for (const copy of copies) {
    const list = byCard.get(copy.cardId) ?? [];
    list.push(copy);
    byCard.set(copy.cardId, list);
  }
  const copyIds: string[] = [];
  let dust = 0;
  for (const list of byCard.values()) {
    let excess = list.reduce((sum, c) => sum + starEquivalents(c.stars), 0) - MAX_EQUIVALENTS;
    const plain = list.filter(isPlainCopy).sort((a, b) => a.stars - b.stars);
    for (const copy of plain) {
      const eq = starEquivalents(copy.stars);
      if (eq > excess) continue;
      excess -= eq;
      copyIds.push(copy.id);
      dust += dustValue(copy.rarity, copy.variant, copy.stars);
    }
  }
  return { copyIds, dust };
}

/** Stardust for dusting the given copies. */
export function dustTotal(copies: readonly DustableCopy[]): number {
  return copies.reduce((sum, c) => sum + dustValue(c.rarity, c.variant, c.stars), 0);
}
