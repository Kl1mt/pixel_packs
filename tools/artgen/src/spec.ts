import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { CARD_CATALOG, RealmSchema } from '@pixel-packs/shared';

/**
 * A spec file (tools/artgen/specs/*.json) lists generation jobs. A job either names a
 * card (its artPrompt is wrapped in the §19 template) or gives a raw description.
 */
const JobBase = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'job ids are kebab-case'),
  cardId: z.string().optional(),
  description: z.string().min(1).optional(),
  /** Realm whose sub-palette becomes `target_palette`; "master" for the master palette. */
  palette: z.union([RealmSchema, z.literal('master'), z.literal('none')]).default('none'),
  seed: z.number().int().min(0),
  noBackground: z.boolean().default(true),
  /** Repo-relative directory the candidates are written to. */
  outDir: z.string().min(1),
});

const GenerateImageJob = JobBase.extend({
  endpoint: z.literal('generate-image-v2'),
  size: z.object({ width: z.number().int().min(16), height: z.number().int().min(16) }),
});

const StyleJob = JobBase.extend({
  endpoint: z.literal('generate-with-style-v2'),
  /** Repo-relative PNG paths, 1–4 (output size follows the largest one). */
  styleImages: z.array(z.string()).min(1).max(4),
  styleDescription: z.string().max(500).optional(),
});

export const JobSpecSchema = z
  .discriminatedUnion('endpoint', [GenerateImageJob, StyleJob])
  .refine((j) => (j.cardId === undefined) !== (j.description === undefined), {
    message: 'a job needs exactly one of cardId or description',
  })
  .refine((j) => j.cardId === undefined || CARD_CATALOG.some((c) => c.id === j.cardId), {
    message: 'unknown cardId',
  });
export type JobSpec = z.infer<typeof JobSpecSchema>;

export const SpecFileSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    jobs: z.array(JobSpecSchema).min(1),
  })
  .refine((s) => new Set(s.jobs.map((j) => j.id)).size === s.jobs.length, {
    message: 'job ids must be unique within a spec',
  });
export type SpecFile = z.infer<typeof SpecFileSchema>;

export async function loadSpec(path: string): Promise<SpecFile> {
  return SpecFileSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
