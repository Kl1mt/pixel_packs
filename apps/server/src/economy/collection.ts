import { and, asc, eq, isNull } from 'drizzle-orm';
import { StarsSchema, type CollectionResponse } from '@pixel-packs/shared';
import { userCards } from '../db/schema.js';
import type { EconomyCtx } from './context.js';

/** Every live copy of the player (dusted copies are gone), oldest first (GDD §12 binder). */
export async function collection(ctx: EconomyCtx, userId: string): Promise<CollectionResponse> {
  const rows = await ctx.db
    .select({
      userCardId: userCards.id,
      cardId: userCards.cardId,
      variant: userCards.variant,
      stars: userCards.stars,
      editionSeason: userCards.editionSeason,
      mintNumber: userCards.mintNumber,
      source: userCards.source,
      acquiredAt: userCards.acquiredAt,
      tradeLockUntil: userCards.tradeLockUntil,
      accountBound: userCards.accountBound,
    })
    .from(userCards)
    .where(and(eq(userCards.userId, userId), isNull(userCards.removedAt)))
    .orderBy(asc(userCards.acquiredAt), asc(userCards.id));
  return {
    copies: rows.map(({ editionSeason, acquiredAt, tradeLockUntil, stars, ...r }) => ({
      ...r,
      stars: StarsSchema.parse(stars),
      edition: editionSeason === null ? null : { season: editionSeason },
      acquiredAt: acquiredAt.toISOString(),
      tradeLockUntil: tradeLockUntil?.toISOString() ?? null,
    })),
  };
}
