import { z } from 'zod';
import { RaritySchema, RealmSchema, VariantSchema } from './enums.js';

/** Ability building blocks (GDD §4). Rules text is generated from this data. */
export const AbilityTriggerSchema = z.enum([
  'startOfBattle',
  'onEnter',
  'onHurt',
  'onAllyFaint',
  'onFaint',
  'support',
]);
export const AbilityEffectSchema = z.enum([
  'damage',
  'heal',
  'buffAtk',
  'buffHp',
  'shield',
  'thorns',
  'regen',
  'weaken',
]);
export const AbilityTargetSchema = z.enum([
  'self',
  'front',
  'behind',
  'allAllies',
  'enemyFront',
  'enemyBack',
  'randomEnemy',
]);

export type AbilityTrigger = z.infer<typeof AbilityTriggerSchema>;
export type AbilityEffect = z.infer<typeof AbilityEffectSchema>;
export type AbilityTarget = z.infer<typeof AbilityTargetSchema>;

/** `every` (ticks) is required for `support` abilities and forbidden otherwise. */
export const AbilitySchema = z
  .object({
    trigger: AbilityTriggerSchema,
    effect: AbilityEffectSchema,
    target: AbilityTargetSchema,
    value: z.int().min(1),
    every: z.int().min(1).optional(),
  })
  .refine((a) => (a.trigger === 'support') === (a.every !== undefined), {
    message: '`every` must be set exactly when trigger is "support"',
  });
export type Ability = z.infer<typeof AbilitySchema>;

/** Card id: `<REALM>-<NNN>`, e.g. `MOS-007`. */
export const CardIdSchema = z.string().regex(/^[A-Z]{3}-\d{3}$/);

/** A catalog entry (GDD §4). */
export const CardSchema = z.object({
  id: CardIdSchema,
  set: z.string().min(1),
  name: z.string().min(1),
  realm: RealmSchema,
  rarity: RaritySchema,
  atk: z.int().min(0),
  hp: z.int().min(1),
  abilities: z.array(AbilitySchema).min(1).max(2),
  flavour: z.string().max(90),
  artPrompt: z.string().min(1),
  flags: z.object({ event: z.boolean(), craftable: z.boolean() }),
});
export type Card = z.infer<typeof CardSchema>;

export const StarsSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Stars = z.infer<typeof StarsSchema>;

export const CopySourceSchema = z.enum(['pack', 'craft', 'fusion', 'starter']);
export type CopySource = z.infer<typeof CopySourceSchema>;

/** "1st Edition · S‹n›" stamp (GDD §6). Season 0 never stamps. */
export const EditionStampSchema = z.object({ season: z.int().min(1) });
export type EditionStamp = z.infer<typeof EditionStampSchema>;

/** Per-copy traits of an owned card instance (GDD §4, §6). */
export const CardInstanceTraitsSchema = z.object({
  variant: VariantSchema,
  stars: StarsSchema,
  edition: EditionStampSchema.nullable(),
  mintNumber: z.int().min(1).nullable(),
  source: CopySourceSchema,
  acquiredAt: z.iso.datetime(),
  tradeLockUntil: z.iso.datetime().nullable(),
  accountBound: z.boolean(),
});
export type CardInstanceTraits = z.infer<typeof CardInstanceTraitsSchema>;
