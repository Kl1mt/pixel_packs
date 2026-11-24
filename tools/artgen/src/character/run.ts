import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REALM_PALETTES, realmPaletteHex } from '@pixel-packs/shared';
import type { PixelLabClient } from '../api/client.js';
import { findEntry, writeManifest, type Entry, type Manifest } from '../manifest.js';
import { fromRepo, toRepo } from '../paths.js';
import { contactSheet, decodePng, encodePng } from '../png.js';
import { CharacterCreatedSchema, AnimationCreatedSchema, frameBuffer } from './api.js';
import { waitForCharacter, type CharacterDetail } from './api.js';
import { animationPreview } from './preview.js';
import {
  animationCost,
  characterCost,
  characterDescription,
  type AnimationJob,
  type CharacterJob,
  type CharacterSpec,
} from './spec.js';

export interface CharacterRunOptions {
  client: PixelLabClient | null;
  manifest: Manifest;
  manifestPath?: string;
  dryRun: boolean;
  only: string[];
  budget: number;
  log: (msg: string) => void;
}

type Job = { kind: 'character'; job: CharacterJob } | { kind: 'animation'; job: AnimationJob };

export function cardArtPath(cardId: string): string {
  return `apps/client/public/assets/cards/${cardId}.png`;
}

export function planCharacterJobs(
  spec: CharacterSpec,
  manifest: Manifest,
  only: string[],
  budget: number,
) {
  const all: Job[] = [
    ...spec.characters.map((job) => ({ kind: 'character' as const, job })),
    ...spec.animations.map((job) => ({ kind: 'animation' as const, job })),
  ];
  const run: Job[] = [];
  const skipped: { job: string; reason: string }[] = [];
  let planned = 0;
  for (const j of all) {
    if (only.length > 0 && !only.includes(j.job.id)) continue;
    if (findEntry(manifest, `${spec.id}/${j.job.id}`)?.status === 'completed') {
      skipped.push({ job: j.job.id, reason: 'already completed' });
      continue;
    }
    const cost = j.kind === 'character' ? characterCost() : animationCost(j.job);
    if (planned + cost > budget) {
      skipped.push({ job: j.job.id, reason: `over budget (${planned}+${cost} > ${budget})` });
      continue;
    }
    planned += cost;
    run.push(j);
  }
  return { run, skipped, planned };
}

export function characterBody(job: CharacterJob, referenceBase64: string) {
  return {
    description: characterDescription(job.cardId),
    reference_image: { type: 'base64', base64: referenceBase64, format: 'png' },
    n_directions: job.nDirections,
    view: job.view,
    template_id: job.templateId,
    seed: job.seed,
    no_background: true,
  };
}

export function animationBody(spec: CharacterSpec, job: AnimationJob, characterId: string) {
  const action = [job.action, spec.animationConstraints].filter((s) => s !== '').join(' ');
  return {
    character_id: characterId,
    mode: 'v3',
    animation_name: `${job.name}-${job.direction}`,
    action_description: action,
    frame_count: job.frameCount,
    directions: [job.direction],
    keep_first_frame: false,
    seed: job.seed,
    target_palette:
      job.palette === 'none'
        ? undefined
        : { name: REALM_PALETTES[job.palette]?.name, colors: realmPaletteHex(job.palette) },
  };
}

async function writeFiles(outDir: string, files: { name: string; data: Buffer }[]) {
  const dir = fromRepo(outDir);
  await mkdir(dir, { recursive: true });
  const outputs: Entry['outputs'] = [];
  for (const f of files) {
    const file = join(dir, f.name);
    await writeFile(file, f.data);
    outputs.push({ index: outputs.length + 1, file: toRepo(file), review: 'pending' });
  }
  return outputs;
}

async function runCharacter(client: PixelLabClient, job: CharacterJob) {
  const ref = await readFile(fromRepo(cardArtPath(job.cardId)));
  const body = characterBody(job, ref.toString('base64'));
  const created = await client.post('/create-character-v3', CharacterCreatedSchema, body);
  const status = await client.waitForJob(created.background_job_id);
  const params = { ...body, reference_image: cardArtPath(job.cardId) };
  const base = { backgroundJobId: created.background_job_id, params, status };
  if (status.status !== 'completed') return { ...base, outputs: [], extra: {} };
  const c = await waitForCharacter(client, created.character_id, (d) => !!d.rotation_urls?.south);
  const files: { name: string; data: Buffer }[] = [];
  for (const [dir, url] of Object.entries(c.rotation_urls ?? {})) {
    if (url) files.push({ name: `${dir}.png`, data: await client.download(url) });
  }
  const outputs = await writeFiles(job.outDir, files);
  const extra = { characterId: created.character_id, view: c.view, size: c.size };
  return { ...base, outputs, extra };
}

function findAnimation(c: CharacterDetail, groupId: string | null | undefined, job: AnimationJob) {
  const name = `${job.name}-${job.direction}`;
  const group =
    c.animations.find((a) => groupId && a.animation_group_id === groupId) ??
    c.animations.find((a) => a.display_name === name);
  return group?.directions.find((d) => d.direction === job.direction && d.frames.length > 0);
}

async function runAnimation(
  client: PixelLabClient,
  spec: CharacterSpec,
  job: AnimationJob,
  characterId: string,
) {
  const body = animationBody(spec, job, characterId);
  const created = await client.post('/characters/animations', AnimationCreatedSchema, body);
  const statuses = [];
  for (const id of created.background_job_ids) statuses.push(await client.waitForJob(id));
  const generations = statuses.reduce((s, st) => s + (st.usage?.generations ?? 0), 0);
  const failed = statuses.find((s) => s.status !== 'completed');
  const base = {
    backgroundJobId: created.background_job_ids.join(','),
    params: body,
    generations,
    usd: statuses.reduce((s, st) => s + (st.last_response?.usage_cost_usd ?? 0), 0),
  };
  if (failed)
    return {
      ...base,
      ok: false,
      error: JSON.stringify(failed.last_response?.error ?? 'failed'),
      outputs: [],
      extra: {},
    };
  const c = await waitForCharacter(
    client,
    characterId,
    (d) => !!findAnimation(d, created.animation_group_id, job),
  );
  const dirFrames = findAnimation(c, created.animation_group_id, job);
  const frames = await Promise.all((dirFrames?.frames ?? []).map((f) => frameBuffer(client, f)));
  const pngs = frames.map((b) => decodePng(b));
  const files = frames.map((data, n) => ({ name: `${String(n + 1).padStart(2, '0')}.png`, data }));
  files.push({ name: 'sheet.png', data: encodePng(contactSheet(pngs, pngs.length, 4)) });
  files.push({ name: 'preview.png', data: animationPreview(pngs, job.delayMs) });
  const outputs = await writeFiles(job.outDir, files);
  const first = pngs[0];
  const extra = {
    characterId,
    animationGroupId: created.animation_group_id ?? null,
    frames: pngs.length,
    frameSize: first ? { width: first.width, height: first.height } : null,
  };
  return { ...base, ok: true, error: undefined, outputs, extra };
}

export async function runCharacterSpec(spec: CharacterSpec, opts: CharacterRunOptions) {
  const { run, skipped, planned } = planCharacterJobs(spec, opts.manifest, opts.only, opts.budget);
  for (const s of skipped) opts.log(`skip ${s.job}: ${s.reason}`);
  opts.log(
    `${run.length} job(s), estimated ${planned} generation(s)${opts.dryRun ? ' (dry run)' : ''}`,
  );
  let spent = 0;
  for (const j of run) {
    const id = `${spec.id}/${j.job.id}`;
    if (opts.dryRun || !opts.client) {
      opts.log(
        `[dry] ${j.job.id} → ${j.kind === 'character' ? `/create-character-v3 (${j.job.view})` : `/characters/animations ${j.job.name} ${j.job.direction}`}`,
      );
      continue;
    }
    opts.log(`${j.job.id}: submitting…`);
    const entry: Entry = {
      id,
      spec: spec.id,
      job: j.job.id,
      endpoint: j.kind === 'character' ? 'create-character-v3' : 'characters/animations',
      params: {},
      seed: j.job.seed,
      status: 'completed',
      cost: { generations: 0 },
      createdAt: new Date().toISOString(),
      outputs: [],
    };
    let filled: boolean;
    try {
      filled = await fillEntry(entry, j, spec, opts);
    } catch (e) {
      // Something failed after submitting: keep a record (cost estimated) before stopping.
      entry.status = 'failed';
      entry.error = String(e).slice(0, 500);
      entry.cost = { generations: j.kind === 'character' ? characterCost() : animationCost(j.job) };
      entry.id = `${id}/failed-${String(Date.now())}`;
      opts.manifest.entries.push(entry);
      await writeManifest(opts.manifest, opts.manifestPath);
      throw e;
    }
    if (!filled) continue;
    if (entry.status === 'failed') entry.id = `${id}/failed-${String(Date.now())}`;
    opts.manifest.entries.push(entry);
    await writeManifest(opts.manifest, opts.manifestPath);
    spent += entry.cost.generations;
    opts.log(
      `${j.job.id}: ${entry.status}, ${entry.outputs.length} file(s), ${entry.cost.generations} generation(s)`,
    );
  }
  return { spent };
}

/** Runs one job into `entry`; false if it was skipped before submitting. */
async function fillEntry(
  entry: Entry,
  j: Job,
  spec: CharacterSpec,
  opts: CharacterRunOptions,
): Promise<boolean> {
  const client = opts.client;
  if (!client) return false;
  if (j.kind === 'character') {
    entry.cardId = j.job.cardId;
    const r = await runCharacter(client, j.job);
    entry.params = r.params;
    entry.backgroundJobId = r.backgroundJobId;
    entry.status = r.status.status === 'completed' ? 'completed' : 'failed';
    entry.cost = {
      generations:
        r.status.usage?.generations ?? (r.status.status === 'completed' ? characterCost() : 0),
      usd: r.status.last_response?.usage_cost_usd,
    };
    if (entry.status === 'failed')
      entry.error = JSON.stringify(r.status.last_response?.error ?? 'failed').slice(0, 500);
    entry.outputs = r.outputs;
    entry.extra = r.extra;
  } else {
    const charEntry = findEntry(opts.manifest, `${spec.id}/${j.job.character}`);
    const characterId = charEntry?.extra?.characterId;
    if (typeof characterId !== 'string') {
      opts.log(`skip ${j.job.id}: character ${j.job.character} has not been created`);
      return false;
    }
    const r = await runAnimation(client, spec, j.job, characterId);
    entry.params = r.params;
    entry.backgroundJobId = r.backgroundJobId;
    entry.status = r.ok ? 'completed' : 'failed';
    entry.cost = { generations: r.generations, usd: r.usd };
    if (r.error) entry.error = r.error.slice(0, 500);
    entry.outputs = r.outputs;
    entry.extra = r.extra;
  }
  return true;
}
