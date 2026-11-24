import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { CARD_CATALOG, RealmSchema } from '@pixel-packs/shared';

/**
 * Character spec (T17, GDD §19): characters made from approved card art with
 * `/create-character-v3`, then per-direction animations with `/characters/animations`.
 */

export const ViewSchema = z.enum(['low top-down', 'high top-down', 'side']);
export const DirectionSchema = z.enum(['south', 'east', 'north', 'west']);
export type Direction = z.infer<typeof DirectionSchema>;

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are kebab-case');

export const CharacterJobSchema = z.object({
  id: Id,
  cardId: z.string().refine((id) => CARD_CATALOG.some((c) => c.id === id), 'unknown cardId'),
  view: ViewSchema,
  /** Skeleton template (`mannequin` for bipeds, or `bear`/`cat`/`dog`/`horse`…). */
  templateId: z.string().default('mannequin'),
  nDirections: z.union([z.literal(4), z.literal(8)]).default(4),
  seed: z.number().int().min(0),
  /** Repo-relative directory the rotation PNGs are written to. */
  outDir: z.string().min(1),
});
export type CharacterJob = z.infer<typeof CharacterJobSchema>;

export const AnimationJobSchema = z.object({
  id: Id,
  /** Id of a character job in the same spec. */
  character: Id,
  /** Animation kind from the §19 table, e.g. `idle`, `walk`. */
  name: z.string().min(1),
  direction: DirectionSchema,
  /** v3 mode: 4–16, even. */
  frameCount: z
    .number()
    .int()
    .min(4)
    .max(16)
    .refine((n) => n % 2 === 0, 'v3 frame counts are even'),
  action: z.string().min(1),
  palette: z.union([RealmSchema, z.literal('none')]).default('none'),
  seed: z.number().int().min(0),
  /** Preview frame duration. */
  delayMs: z.number().int().positive().default(150),
  outDir: z.string().min(1),
});
export type AnimationJob = z.infer<typeof AnimationJobSchema>;

export const CharacterSpecSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    /** Constraint text appended to every animation's action (§19). */
    animationConstraints: z.string().default(''),
    characters: z.array(CharacterJobSchema).min(1),
    animations: z.array(AnimationJobSchema).default([]),
  })
  .refine(
    (s) => {
      const ids = [...s.characters, ...s.animations].map((j) => j.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'job ids must be unique within a spec' },
  )
  .refine((s) => s.animations.every((a) => s.characters.some((c) => c.id === a.character)), {
    message: 'an animation names an unknown character',
  });
export type CharacterSpec = z.infer<typeof CharacterSpecSchema>;

export async function loadCharacterSpec(path: string): Promise<CharacterSpec> {
  return CharacterSpecSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

/** Character prompt: the card's name and art prompt (the reference image carries the look). */
export function characterDescription(cardId: string): string {
  const card = CARD_CATALOG.find((c) => c.id === cardId);
  if (!card) throw new Error(`unknown card ${cardId}`);
  return `${card.name}: ${card.artPrompt}`;
}

/** Estimated generations (receipts in the manifest are the truth; GDD §19 / API notes). */
export function characterCost(side = 64): number {
  return Math.ceil((side * side * 8) / 65536);
}

export function animationCost(job: AnimationJob, side = 64): number {
  return Math.ceil((side * side * job.frameCount) / 65536);
}
