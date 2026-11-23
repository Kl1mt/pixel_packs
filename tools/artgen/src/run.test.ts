import { describe, expect, it } from 'vitest';
import { realmPaletteHex } from '@pixel-packs/shared';
import type { GenerateImageV2Body } from './api/schemas.js';
import { emptyManifest, type Entry } from './manifest.js';
import { buildRequest, jobDescription, planJobs } from './run.js';
import { JobSpecSchema, SpecFileSchema, type SpecFile } from './spec.js';

const job = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  endpoint: 'generate-image-v2',
  cardId: 'MOS-003',
  palette: 'mossgrove',
  seed: 1,
  size: { width: 64, height: 64 },
  outDir: `tools/artgen/candidates/test/${id}`,
  ...extra,
});

const spec = (jobs: unknown[]): SpecFile => SpecFileSchema.parse({ id: 's', jobs });

const done = (id: string): Entry => ({
  id: `s/${id}`,
  spec: 's',
  job: id,
  endpoint: 'generate-image-v2',
  params: {},
  seed: 1,
  status: 'completed',
  cost: { generations: 10 },
  createdAt: '2026-11-23T00:00:00Z',
  outputs: [],
});

describe('spec validation', () => {
  it('needs exactly one of cardId and description', () => {
    expect(JobSpecSchema.safeParse(job('a', { description: 'x' })).success).toBe(false);
    expect(JobSpecSchema.safeParse(job('a', { cardId: undefined })).success).toBe(false);
    expect(JobSpecSchema.safeParse(job('a', { cardId: undefined, description: 'x' })).success).toBe(
      true,
    );
  });

  it('rejects unknown cards, bad ids and duplicate jobs', () => {
    expect(JobSpecSchema.safeParse(job('a', { cardId: 'MOS-999' })).success).toBe(false);
    expect(JobSpecSchema.safeParse(job('Bad Id')).success).toBe(false);
    expect(SpecFileSchema.safeParse({ id: 's', jobs: [job('a'), job('a')] }).success).toBe(false);
  });

  it('caps style images at 4', () => {
    const styleJob = (n: number) => ({
      ...job('a'),
      endpoint: 'generate-with-style-v2',
      size: undefined,
      styleImages: Array.from({ length: n }, (_, i) => `x${String(i)}.png`),
    });
    expect(JobSpecSchema.safeParse(styleJob(4)).success).toBe(true);
    expect(JobSpecSchema.safeParse(styleJob(5)).success).toBe(false);
  });
});

describe('planJobs', () => {
  const s = spec([job('a'), job('b'), job('c')]);

  it('stops at the budget', () => {
    const plan = planJobs(s, emptyManifest(), [], 25);
    expect(plan.run.map((j) => j.id)).toEqual(['a', 'b']);
    expect(plan.planned).toBe(20);
    expect(plan.skipped).toEqual([
      { job: 'c', reason: expect.stringContaining('over budget') as string },
    ]);
  });

  it('skips completed jobs and honours --only', () => {
    const manifest = { version: 1 as const, entries: [done('a')] };
    expect(planJobs(s, manifest, [], 100).run.map((j) => j.id)).toEqual(['b', 'c']);
    expect(planJobs(s, manifest, ['a', 'c'], 100).run.map((j) => j.id)).toEqual(['c']);
  });
});

describe('buildRequest', () => {
  it('wraps the card prompt and passes the realm palette and seed', async () => {
    const [j] = spec([job('a', { seed: 42 })]).jobs;
    if (!j) throw new Error('no job');
    const body = (await buildRequest(j)).body as GenerateImageV2Body;
    expect(body.description).toBe(jobDescription(j));
    expect(body.description).toMatch(/^a baby hedgehog .*no scenery$/);
    expect(body.target_palette?.colors).toEqual(realmPaletteHex('mossgrove'));
    expect(body.seed).toBe(42);
    expect(body.no_background).toBe(true);
  });

  it('omits the palette for palette "none"', async () => {
    const [j] = spec([job('a', { palette: 'none' })]).jobs;
    if (!j) throw new Error('no job');
    expect(((await buildRequest(j)).body as GenerateImageV2Body).target_palette).toBeUndefined();
  });
});
