import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { PixelLabClient } from '../api/client.js';
import { writeManifest, type Entry, type Manifest } from '../manifest.js';
import { fromRepo } from '../paths.js';
import { clipCost, clipPrompt, type ClipSpec, type SfxSpec } from './spec.js';

/** `POST /sound-effects` → 202. */
export const SfxStartedSchema = z.object({
  background_job_id: z.string(),
  quoted_generations: z.number(),
  sound_effect: z.looseObject({ id: z.string() }),
});

/** `GET /sound-effects/{id}`. */
export const SoundEffectSchema = z.looseObject({
  id: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  error: z.string().nullish(),
  audio_url: z.string().nullish(),
  duration_ms: z.number().nullish(),
});
export type SoundEffect = z.infer<typeof SoundEffectSchema>;

export const takeEntryId = (spec: SfxSpec, clip: ClipSpec, take: number) =>
  `${spec.id}/${clip.id}/take-${String(take)}`;
export const takeFile = (
  spec: SfxSpec,
  clip: ClipSpec,
  take: number,
  root = 'tools/artgen/candidates',
) => `${root}/${spec.id}/${clip.id}-${String(take)}.wav`;

/** Completed takes of a clip, in order. */
export function takesOf(manifest: Manifest, spec: SfxSpec, clip: ClipSpec): Entry[] {
  return manifest.entries.filter(
    (e) => e.spec === spec.id && e.job === clip.id && e.status === 'completed',
  );
}

function nextTake(manifest: Manifest, spec: SfxSpec, clip: ClipSpec): number {
  const all = manifest.entries.filter((e) => e.spec === spec.id && e.job === clip.id);
  return all.length + 1;
}

export interface SfxPlanItem {
  clip: ClipSpec;
  take: number;
  cost: number;
}

/**
 * Clips to make: by default those with no completed take; with `retake`, one more
 * take of each listed clip. Stops adding once the budget would be exceeded.
 */
export function planSfx(
  spec: SfxSpec,
  manifest: Manifest,
  opts: { only: string[]; retake: boolean; budget: number },
) {
  const run: SfxPlanItem[] = [];
  const skipped: { clip: string; reason: string }[] = [];
  let planned = 0;
  for (const id of opts.only) {
    if (!spec.clips.some((c) => c.id === id)) throw new Error(`unknown clip ${id}`);
  }
  for (const clip of spec.clips) {
    if (opts.only.length > 0 && !opts.only.includes(clip.id)) continue;
    if (!opts.retake && takesOf(manifest, spec, clip).length > 0) {
      skipped.push({ clip: clip.id, reason: 'already has a take' });
      continue;
    }
    const cost = clipCost(clip.seconds);
    if (planned + cost > opts.budget) {
      skipped.push({ clip: clip.id, reason: `over budget (${planned}+${cost} > ${opts.budget})` });
      continue;
    }
    planned += cost;
    run.push({ clip, take: nextTake(manifest, spec, clip), cost });
  }
  return { run, skipped, planned };
}

export interface SfxRunOptions {
  client: PixelLabClient;
  manifest: Manifest;
  manifestPath?: string;
  items: SfxPlanItem[];
  log: (msg: string) => void;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  /** Where WAVs go (repo-relative or absolute); default `tools/artgen/candidates`. */
  outRoot?: string;
  /** Jobs in flight at once (PixelLab answers 429 past its limit). */
  concurrency?: number;
}

/** Makes each planned take, downloads the WAV and logs it in the manifest. */
export async function runSfx(spec: SfxSpec, opts: SfxRunOptions): Promise<number> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pollMs = opts.pollMs ?? 4000;
  let spent = 0;
  // Writes are chained so two workers never write the temp file at once.
  let saving = Promise.resolve();
  const save = () => (saving = saving.then(() => writeManifest(opts.manifest, opts.manifestPath)));
  const queue = [...opts.items];

  async function one(item: SfxPlanItem): Promise<void> {
    const { clip, take } = item;
    const params = { prompt: clipPrompt(spec, clip), seconds: clip.seconds, name: clip.id };
    const createdAt = new Date().toISOString();
    const started = await opts.client.post('/sound-effects', SfxStartedSchema, params);
    let sfx: SoundEffect;
    for (;;) {
      await sleep(pollMs);
      sfx = await opts.client.get(`/sound-effects/${started.sound_effect.id}`, SoundEffectSchema);
      if (sfx.status === 'completed' || sfx.status === 'failed') break;
    }
    const base = {
      spec: spec.id,
      job: clip.id,
      endpoint: 'sound-effects',
      params,
      seed: 0,
      backgroundJobId: started.background_job_id,
      createdAt,
      extra: { soundEffectId: sfx.id, durationMs: sfx.duration_ms ?? null },
    };
    if (sfx.status === 'failed' || !sfx.audio_url) {
      opts.manifest.entries.push({
        ...base,
        id: `${takeEntryId(spec, clip, take)}-failed`,
        status: 'failed',
        cost: { generations: 0 },
        error: sfx.error ?? 'no audio_url',
        outputs: [],
      });
      opts.log(`  ${clip.id} take ${String(take)} failed: ${sfx.error ?? '?'}`);
    } else {
      const file = takeFile(spec, clip, take, opts.outRoot);
      await mkdir(dirname(fromRepo(file)), { recursive: true });
      await writeFile(fromRepo(file), await opts.client.download(sfx.audio_url));
      opts.manifest.entries.push({
        ...base,
        id: takeEntryId(spec, clip, take),
        status: 'completed',
        cost: { generations: started.quoted_generations },
        outputs: [{ index: take, file, review: 'pending' }],
      });
      spent += started.quoted_generations;
      opts.log(`  ${clip.id} take ${String(take)} → ${file} (${String(sfx.duration_ms)} ms)`);
    }
    await save();
  }

  const workers = Array.from({ length: opts.concurrency ?? 3 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await one(item);
  });
  await Promise.all(workers);
  return spent;
}
