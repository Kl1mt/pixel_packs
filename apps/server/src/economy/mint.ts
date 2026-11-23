import { sql } from 'drizzle-orm';
import type { MintNumberAllocator, Variant } from '@pixel-packs/shared';
import { mintCounters } from '../db/schema.js';
import type { Tx } from './db.js';

/**
 * Mint numbers (GDD §6) from `mint_counters`. The upsert locks the (card, variant) row
 * until the pull commits, so numbers are global, gap-free and never reused: a rolled-back
 * pull also rolls back its number.
 */
export function createMintAllocator(tx: Tx): MintNumberAllocator {
  return {
    async next(cardId: string, variant: Variant): Promise<number> {
      const [row] = await tx
        .insert(mintCounters)
        .values({ cardId, variant, lastNumber: 1 })
        .onConflictDoUpdate({
          target: [mintCounters.cardId, mintCounters.variant],
          set: { lastNumber: sql`${mintCounters.lastNumber} + 1` },
        })
        .returning({ n: mintCounters.lastNumber });
      if (!row) throw new Error('mint counter upsert returned nothing');
      return row.n;
    },
  };
}
