import { z } from 'zod';
import { CardIdSchema } from './card.js';
import { RaritySchema, RealmSchema, VariantSchema } from './enums.js';

/**
 * Pack types (GDD §7). Event packs arrive with their own task; their pity group
 * will be `event:<id>`.
 */
export const PackTypeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('realm'), realm: RealmSchema }),
  z.object({ kind: z.literal('mythic') }),
]);
export type PackType = z.infer<typeof PackTypeSchema>;

export const PityGroupSchema = z.enum(['realm', 'mythic']);
export type PityGroup = z.infer<typeof PityGroupSchema>;

/** Pity counters of one pity group: packs opened since the last hit (GDD §5). */
export const PityCountersSchema = z.object({
  packsSinceLegendaryPlus: z.int().min(0),
  packsSinceMythic: z.int().min(0),
});
export type PityCounters = z.infer<typeof PityCountersSchema>;

export const FRESH_PITY: PityCounters = Object.freeze({
  packsSinceLegendaryPlus: 0,
  packsSinceMythic: 0,
});

export const RolledCardSchema = z.object({
  slot: z.int().min(1).max(5),
  featured: z.boolean(),
  cardId: CardIdSchema,
  realm: RealmSchema,
  rarity: RaritySchema,
  variant: VariantSchema,
});
export type RolledCard = z.infer<typeof RolledCardSchema>;

/** Why the featured slot was forced, if it was (shown in pull history). */
export const PityTriggerSchema = z.enum(['legendaryHard', 'mythicHard']).nullable();
export type PityTrigger = z.infer<typeof PityTriggerSchema>;

export const PackRollSchema = z.object({
  cards: z.array(RolledCardSchema).length(5),
  /** Counters to store after this pack (unchanged for scripted packs). */
  pity: PityCountersSchema,
  pityTrigger: PityTriggerSchema,
  /** Extra Mythic chance (per mille) applied to the featured slot by soft pity. */
  mythicSoftPityBonus: z.int().min(0),
  scripted: z.boolean(),
});
export type PackRoll = z.infer<typeof PackRollSchema>;
