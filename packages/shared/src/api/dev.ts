import { z } from 'zod';
import { RaritySchema, VariantSchema } from '../model/enums.js';
import { PackTypeIdSchema } from './economy.js';

/**
 * Dev-only routes (T12): `/api/dev/*` exists only on a server with dev overrides
 * allowed (never `NODE_ENV=production`). The `/debug` page uses them to force results.
 */
export const DevOddsOverrideRequestSchema = z.object({
  /** How many of the next packs are forced; 0 clears the override. */
  packs: z.int().min(0).max(50),
  rarity: RaritySchema.optional(),
  variant: VariantSchema.optional(),
});
export type DevOddsOverrideRequest = z.infer<typeof DevOddsOverrideRequestSchema>;

export const DevGrantRequestSchema = z
  .object({
    gold: z.int().min(1).max(100_000).optional(),
    gems: z.int().min(1).max(100_000).optional(),
    packs: z.object({ packTypeId: PackTypeIdSchema, count: z.int().min(1).max(50) }).optional(),
  })
  .refine((g) => g.gold !== undefined || g.gems !== undefined || g.packs !== undefined, {
    message: 'Grant something',
  });
export type DevGrantRequest = z.infer<typeof DevGrantRequestSchema>;
