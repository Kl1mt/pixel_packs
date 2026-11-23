import { readFile } from 'node:fs/promises';
import { z } from 'zod';

/** One sound in an SFX spec (`POST /sound-effects`, GDD §20). */
export const ClipSpecSchema = z.object({
  /** Also the sprite key in the client, e.g. `ui.press`. */
  id: z.string().regex(/^[a-z0-9.-]+$/),
  prompt: z.string().min(1).max(1000),
  /** Clip length asked for, 0.5–30 s to 0.1 s. */
  seconds: z.number().min(0.5).max(30),
});
export type ClipSpec = z.infer<typeof ClipSpecSchema>;

export const SfxSpecSchema = z.object({
  id: z.string().min(1),
  /** Prepended to every prompt so the set sounds like one game. */
  style: z.string().default(''),
  clips: z.array(ClipSpecSchema).min(1),
});
export type SfxSpec = z.infer<typeof SfxSpecSchema>;

export async function loadSfxSpec(path: string): Promise<SfxSpec> {
  const spec = SfxSpecSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  const ids = new Set<string>();
  for (const c of spec.clips) {
    if (ids.has(c.id)) throw new Error(`duplicate clip id ${c.id}`);
    ids.add(c.id);
  }
  return spec;
}

/** Documented price: 0.614 generations per second, rounded up (1.6 s → 1, 3.2 s → 2, 10 s → 7). */
export function clipCost(seconds: number): number {
  return Math.max(1, Math.ceil(Math.round(seconds * 10) * 0.0614 - 1e-9));
}

export function clipPrompt(spec: SfxSpec, clip: ClipSpec): string {
  return spec.style ? `${clip.prompt}. ${spec.style}` : clip.prompt;
}
