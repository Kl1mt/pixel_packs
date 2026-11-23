import { z } from 'zod';
import { CardIdSchema, CardInstanceTraitsSchema } from '../model/card.js';
import { RaritySchema, VariantSchema } from '../model/enums.js';
import { PackTypeIdSchema, PullHistoryQuerySchema } from './economy.js';

/** One live copy the player owns (GDD §4, §6): the card plus its per-copy traits. */
export const CollectionCopySchema = CardInstanceTraitsSchema.extend({
  userCardId: z.uuid(),
  cardId: CardIdSchema,
});
export type CollectionCopy = z.infer<typeof CollectionCopySchema>;

/** `GET /api/cards`: every live copy (dusted copies are gone), oldest first. */
export const CollectionResponseSchema = z.object({ copies: z.array(CollectionCopySchema) });
export type CollectionResponse = z.infer<typeof CollectionResponseSchema>;

/** Optional filters for `GET /api/packs/history` (GDD §12: "every opening, filterable"). */
export const PullHistoryFilterSchema = z.object({
  packTypeId: PackTypeIdSchema.optional(),
  /** Only openings with at least one card of this rarity or higher. */
  minRarity: RaritySchema.optional(),
  /** Only openings with at least one copy of this variant. */
  variant: VariantSchema.optional(),
});
export type PullHistoryFilter = z.infer<typeof PullHistoryFilterSchema>;

/** The full history query: paging plus the filters. */
export const PullHistoryFilteredQuerySchema = PullHistoryQuerySchema.extend(
  PullHistoryFilterSchema.shape,
);
