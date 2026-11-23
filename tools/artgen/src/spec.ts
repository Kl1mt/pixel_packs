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

const Size = z.object({ width: z.number().int().min(16), height: z.number().int().min(16) });

const ProFlashJob = JobBase.extend({
  endpoint: z.literal('create-image-pro-flash'),
  size: Size,
  /** Optional repo-relative PNG lending its look (outline, shading); the palette wins on colour. */
  styleImage: z.string().optional(),
  styleUsage: z.string().optional(),
});

const PixfluxJob = JobBase.extend({
  endpoint: z.literal('create-image-pixflux'),
  size: Size,
  outline: z.string().optional(),
  shading: z.string().optional(),
  detail: z.string().optional(),
  view: z.string().optional(),
});

const FontJob = JobBase.extend({
  endpoint: z.literal('generate-font-pro'),
  weight: z.enum(['Bold', 'Regular']),
  glyphPx: z.union([
    z.literal(8),
    z.literal(12),
    z.literal(16),
    z.literal(24),
    z.literal(32),
    z.literal(64),
  ]),
  fontName: z.string().max(200).optional(),
});

const UiAssetJob = JobBase.extend({
  endpoint: z.literal('create-ui-asset'),
  size: z.object({
    width: z.number().int().min(192).max(688),
    height: z.number().int().min(192).max(688),
  }),
  elements: z.array(z.string()).optional(),
  styleImage: z.string().optional(),
});

const UiStatesJob = JobBase.extend({
  endpoint: z.literal('ui-assets/states'),
  /** Element ids from `artgen ui-split` (recorded in the template's manifest entry). */
  elementIds: z.array(z.string()).min(1),
  states: z.array(z.object({ name: z.string().min(1), description: z.string().min(1) })).min(1),
  /** Longest side of the states grid, for the price estimate (10 up to 256 px). */
  gridSide: z.number().int().positive().default(256),
});

export const JobSpecSchema = z
  .discriminatedUnion('endpoint', [
    GenerateImageJob,
    StyleJob,
    ProFlashJob,
    PixfluxJob,
    FontJob,
    UiAssetJob,
    UiStatesJob,
  ])
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
