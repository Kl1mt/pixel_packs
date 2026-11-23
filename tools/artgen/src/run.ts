import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CARD_CATALOG,
  REALM_PALETTES,
  masterPaletteHex,
  realmPaletteHex,
} from '@pixel-packs/shared';
import type { PixelLabClient } from './api/client.js';
import {
  ENDPOINT_COST,
  type GenerateImageV2Body,
  type GenerateWithStyleV2Body,
  type TargetPalette,
} from './api/schemas.js';
import { findEntry, writeManifest, type Entry, type Manifest } from './manifest.js';
import { contactSheet, decodePng, encodePng } from './png.js';
import { fromRepo, toRepo } from './paths.js';
import { cardArtPrompt } from './prompt.js';
import type { JobSpec, SpecFile } from './spec.js';

export function jobDescription(job: JobSpec): string {
  if (job.description !== undefined) return job.description;
  const card = CARD_CATALOG.find((c) => c.id === job.cardId);
  if (!card) throw new Error(`unknown card ${String(job.cardId)}`);
  return cardArtPrompt(card.artPrompt);
}

export function jobPalette(job: JobSpec): TargetPalette | undefined {
  if (job.palette === 'none') return undefined;
  if (job.palette === 'master') return { name: 'Pixel Packs master', colors: masterPaletteHex() };
  return { name: REALM_PALETTES[job.palette]?.name, colors: realmPaletteHex(job.palette) };
}

export interface BuiltRequest {
  body: GenerateImageV2Body | GenerateWithStyleV2Body;
  /** What the manifest records: the body with image data replaced by repo paths. */
  params: Record<string, unknown>;
}

export async function buildRequest(job: JobSpec): Promise<BuiltRequest> {
  const common = {
    description: jobDescription(job),
    seed: job.seed,
    no_background: job.noBackground,
    target_palette: jobPalette(job),
  };
  if (job.endpoint === 'generate-image-v2') {
    const body: GenerateImageV2Body = { ...common, image_size: job.size };
    return { body, params: { ...body } };
  }
  const style_images = await Promise.all(
    job.styleImages.map(async (path) => {
      const buf = await readFile(fromRepo(path));
      const { width, height } = decodePng(buf);
      return {
        image: { type: 'base64' as const, base64: buf.toString('base64'), format: 'png' as const },
        width,
        height,
      };
    }),
  );
  const body: GenerateWithStyleV2Body = {
    ...common,
    style_images,
    style_description: job.styleDescription,
  };
  return { body, params: { ...body, style_images: job.styleImages } };
}

export interface RunOptions {
  client: PixelLabClient | null;
  manifest: Manifest;
  manifestPath?: string;
  dryRun: boolean;
  /** Job ids to run; all when empty. */
  only: string[];
  /** Max generations this run may spend. */
  budget: number;
  log: (msg: string) => void;
}

export interface RunResult {
  ran: string[];
  skipped: string[];
  spent: number;
}

/** Picks the jobs to run: filtered by --only, not yet completed, and within the budget. */
export function planJobs(spec: SpecFile, manifest: Manifest, only: string[], budget: number) {
  const run: JobSpec[] = [];
  const skipped: { job: string; reason: string }[] = [];
  let planned = 0;
  for (const job of spec.jobs) {
    if (only.length > 0 && !only.includes(job.id)) continue;
    if (findEntry(manifest, `${spec.id}/${job.id}`)?.status === 'completed') {
      skipped.push({ job: job.id, reason: 'already completed' });
      continue;
    }
    const cost = ENDPOINT_COST[job.endpoint];
    if (planned + cost > budget) {
      skipped.push({ job: job.id, reason: `over budget (${planned}+${cost} > ${budget})` });
      continue;
    }
    planned += cost;
    run.push(job);
  }
  return { run, skipped, planned };
}

export async function runSpec(spec: SpecFile, opts: RunOptions): Promise<RunResult> {
  const { run, skipped, planned } = planJobs(spec, opts.manifest, opts.only, opts.budget);
  for (const s of skipped) opts.log(`skip ${s.job}: ${s.reason}`);
  opts.log(
    `${run.length} job(s), estimated ${planned} generation(s)${opts.dryRun ? ' (dry run)' : ''}`,
  );
  const result: RunResult = { ran: [], skipped: skipped.map((s) => s.job), spent: 0 };

  for (const job of run) {
    const { body, params } = await buildRequest(job);
    if (opts.dryRun || !opts.client) {
      opts.log(`[dry] ${job.id} → /${job.endpoint} seed ${job.seed}, palette ${job.palette}`);
      opts.log(`      "${body.description}"`);
      continue;
    }
    opts.log(`${job.id}: submitting to /${job.endpoint}…`);
    const jobId = await opts.client.submit(job.endpoint, body);
    const status = await opts.client.waitForJob(jobId);
    const generations =
      status.usage?.generations ??
      (status.status === 'completed' ? ENDPOINT_COST[job.endpoint] : 0);
    const entry: Entry = {
      id: `${spec.id}/${job.id}`,
      spec: spec.id,
      job: job.id,
      cardId: job.cardId,
      endpoint: job.endpoint,
      params,
      seed: job.seed,
      status: status.status === 'completed' ? 'completed' : 'failed',
      backgroundJobId: jobId,
      cost: { generations, usd: status.last_response?.usage_cost_usd },
      createdAt: new Date().toISOString(),
      outputs: [],
    };
    if (entry.status === 'completed') {
      entry.outputs = await writeOutputs(job, status.last_response?.images ?? []);
    } else {
      entry.id = `${entry.id}/failed-${String(Date.now())}`;
      entry.error = JSON.stringify(status.last_response?.error ?? 'failed').slice(0, 500);
    }
    opts.manifest.entries.push(entry);
    await writeManifest(opts.manifest, opts.manifestPath);
    result.spent += generations;
    result.ran.push(job.id);
    opts.log(
      `${job.id}: ${entry.status}, ${entry.outputs.length} image(s), ${generations} generation(s)`,
    );
  }
  return result;
}

export async function writeOutputs(
  job: JobSpec,
  images: { base64: string }[],
): Promise<Entry['outputs']> {
  const dir = fromRepo(job.outDir);
  await mkdir(dir, { recursive: true });
  const pngs = images.map((img) => decodePng(Buffer.from(img.base64, 'base64')));
  const outputs: Entry['outputs'] = [];
  for (const [n, png] of pngs.entries()) {
    const file = join(dir, `${String(n + 1).padStart(2, '0')}.png`);
    await writeFile(file, encodePng(png));
    outputs.push({ index: n + 1, file: toRepo(file), review: 'pending' });
  }
  if (pngs.length > 1) {
    const columns = Math.ceil(Math.sqrt(pngs.length));
    await writeFile(join(dir, 'sheet.png'), encodePng(contactSheet(pngs, columns, 4)));
  }
  return outputs;
}
