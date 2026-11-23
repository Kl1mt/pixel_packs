import { and, asc, eq, isNull, type SQL } from 'drizzle-orm';
import { StarsSchema, type CollectionCopy, type CollectionResponse } from '@pixel-packs/shared';
import { userCards } from '../db/schema.js';
import type { EconomyCtx } from './context.js';
import type { Tx } from './db.js';

/** The player's live copies (dusted copies are gone) matching `where`, oldest first. */
export async function liveCopies(
  db: EconomyCtx['db'] | Tx,
  userId: string,
  where?: SQL,
): Promise<CollectionCopy[]> {
  const rows = await db
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
    .where(and(eq(userCards.userId, userId), isNull(userCards.removedAt), where))
    .orderBy(asc(userCards.acquiredAt), asc(userCards.id));
  return rows.map(({ editionSeason, acquiredAt, tradeLockUntil, stars, ...r }) => ({
    ...r,
    stars: StarsSchema.parse(stars),
    edition: editionSeason === null ? null : { season: editionSeason },
    acquiredAt: acquiredAt.toISOString(),
    tradeLockUntil: tradeLockUntil?.toISOString() ?? null,
  }));
}

/** Every live copy of the player, oldest first (GDD §12 binder). */
export async function collection(ctx: EconomyCtx, userId: string): Promise<CollectionResponse> {
  return { copies: await liveCopies(ctx.db, userId) };
}
