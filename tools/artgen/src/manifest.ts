import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { MANIFEST_PATH } from './paths.js';

export const ReviewSchema = z.enum(['pending', 'approved', 'rejected']);
export type Review = z.infer<typeof ReviewSchema>;

export const OutputSchema = z.object({
  /** 1-based candidate number, row-major in PixelLab's grid. */
  index: z.number().int().min(1),
  file: z.string(),
  review: ReviewSchema.default('pending'),
  note: z.string().optional(),
});
export type Output = z.infer<typeof OutputSchema>;

export const EntrySchema = z.object({
  /** `<specId>/<jobId>` */
  id: z.string(),
  spec: z.string(),
  job: z.string(),
  cardId: z.string().optional(),
  endpoint: z.string(),
  /** Request body with image data replaced by repo paths. */
  params: z.record(z.string(), z.unknown()),
  seed: z.number().int(),
  status: z.enum(['completed', 'failed']),
  backgroundJobId: z.string().optional(),
  cost: z.object({ generations: z.number(), usd: z.number().optional() }),
  createdAt: z.string(),
  error: z.string().optional(),
  /** Ids later steps need, e.g. `uiAssetId`, split `elements`, created `states`. */
  extra: z.record(z.string(), z.unknown()).optional(),
  outputs: z.array(OutputSchema),
});
export type Entry = z.infer<typeof EntrySchema>;

export const ManifestSchema = z.object({
  version: z.literal(1),
  entries: z.array(EntrySchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export function emptyManifest(): Manifest {
  return { version: 1, entries: [] };
}

export async function readManifest(path = MANIFEST_PATH): Promise<Manifest> {
  try {
    return ManifestSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyManifest();
    throw e;
  }
}

/** Atomic write (temp file + rename) so a crash never leaves a half-written manifest. */
export async function writeManifest(manifest: Manifest, path = MANIFEST_PATH): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(ManifestSchema.parse(manifest), null, 2)}\n`);
  await rename(tmp, path);
}

export function totalSpend(manifest: Manifest): number {
  return manifest.entries.reduce((sum, e) => sum + e.cost.generations, 0);
}

export function findEntry(manifest: Manifest, id: string): Entry | undefined {
  return manifest.entries.find((e) => e.id === id);
}

/** Sets the review state of one candidate; returns false if it does not exist. */
export function setReview(
  manifest: Manifest,
  entryId: string,
  index: number,
  review: Review,
  note?: string,
): boolean {
  const output = findEntry(manifest, entryId)?.outputs.find((o) => o.index === index);
  if (!output) return false;
  output.review = review;
  if (note === undefined || note === '') delete output.note;
  else output.note = note;
  return true;
}
