import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PixelLabClient } from './api/client.js';
import { buildRequest, jobCost, jobDescription } from './build.js';
import { execute } from './execute.js';
import { findEntry, writeManifest, type Entry, type Manifest } from './manifest.js';
import { contactSheet, decodePng, encodePng } from './png.js';
import { fromRepo, toRepo } from './paths.js';
import type { JobSpec, SpecFile } from './spec.js';

export { buildRequest, jobCost, jobDescription, jobPalette } from './build.js';

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
    const cost = jobCost(job);
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
      opts.log(`      "${jobDescription(job)}"`);
      continue;
    }
    opts.log(`${job.id}: submitting to /${job.endpoint}…`);
    const res = await execute(opts.client, job, body);
    const entry: Entry = {
      id: `${spec.id}/${job.id}`,
      spec: spec.id,
      job: job.id,
      cardId: job.cardId,
      endpoint: job.endpoint,
      params,
      seed: job.seed,
      status: res.status,
      backgroundJobId: res.backgroundJobId,
      cost: { generations: res.generations, usd: res.usd },
      createdAt: new Date().toISOString(),
      outputs: [],
    };
    if (Object.keys(res.extra).length > 0) entry.extra = res.extra;
    if (entry.status === 'completed') {
      entry.outputs = await writeOutputs(job, res.images, res.files);
    } else {
      entry.id = `${entry.id}/failed-${String(Date.now())}`;
      entry.error = res.error;
    }
    opts.manifest.entries.push(entry);
    await writeManifest(opts.manifest, opts.manifestPath);
    result.spent += res.generations;
    result.ran.push(job.id);
    opts.log(
      `${job.id}: ${entry.status}, ${entry.outputs.length} file(s), ${res.generations} generation(s)`,
    );
  }
  return result;
}

export async function writeOutputs(
  job: JobSpec,
  images: Buffer[],
  files: { name: string; data: Buffer }[] = [],
): Promise<Entry['outputs']> {
  const dir = fromRepo(job.outDir);
  await mkdir(dir, { recursive: true });
  const pngs = images.map((buf) => decodePng(buf));
  const outputs: Entry['outputs'] = [];
  for (const [n, png] of pngs.entries()) {
    const file = join(dir, `${String(n + 1).padStart(2, '0')}.png`);
    await writeFile(file, encodePng(png));
    outputs.push({ index: n + 1, file: toRepo(file), review: 'pending' });
  }
  for (const f of files) {
    const file = join(dir, f.name);
    await writeFile(file, f.data);
    outputs.push({ index: outputs.length + 1, file: toRepo(file), review: 'pending' });
  }
  if (pngs.length > 1) {
    const columns = Math.ceil(Math.sqrt(pngs.length));
    await writeFile(join(dir, 'sheet.png'), encodePng(contactSheet(pngs, columns, 4)));
  }
  return outputs;
}
