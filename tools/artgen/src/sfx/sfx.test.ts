import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PixelLabClient } from '../api/client.js';
import { emptyManifest, type Manifest } from '../manifest.js';
import { planSfx, runSfx } from './run.js';
import { clipCost, clipPrompt, SfxSpecSchema } from './spec.js';
import { layoutSprite, pickTakes, spriteModule } from './sprite.js';

const spec = SfxSpecSchema.parse({
  id: 't',
  style: 'cozy',
  clips: [
    { id: 'a.one', prompt: 'tick', seconds: 0.5 },
    { id: 'b.two', prompt: 'chime', seconds: 3.2 },
  ],
});

const [clipA] = spec.clips;
if (!clipA) throw new Error('spec has no clips');

const take = (job: string, n: number, review: 'pending' | 'approved' = 'pending') => ({
  id: `t/${job}/take-${String(n)}`,
  spec: 't',
  job,
  endpoint: 'sound-effects',
  params: {},
  seed: 0,
  status: 'completed' as const,
  cost: { generations: 1 },
  createdAt: '2026-11-23T00:00:00Z',
  outputs: [{ index: n, file: `x/${job}-${String(n)}.wav`, review }],
});

describe('sfx spec', () => {
  it('prices clips like the documented table', () => {
    expect([0.5, 1.6, 2.5, 3.2, 6, 10, 30].map(clipCost)).toEqual([1, 1, 2, 2, 4, 7, 19]);
  });
  it('appends the set style to each prompt', () => {
    expect(clipPrompt(spec, clipA)).toBe('tick. cozy');
  });
});

describe('planSfx', () => {
  it('plans missing clips within the budget', () => {
    const p = planSfx(spec, emptyManifest(), { only: [], retake: false, budget: 2 });
    expect(p.run.map((r) => r.clip.id)).toEqual(['a.one']);
    expect(p.planned).toBe(1);
    expect(p.skipped[0]?.clip).toBe('b.two');
  });
  it('skips clips with a take unless retaking, which numbers the next take', () => {
    const m: Manifest = { version: 1, entries: [take('a.one', 1)] };
    expect(planSfx(spec, m, { only: [], retake: false, budget: 9 }).run).toHaveLength(1);
    const re = planSfx(spec, m, { only: ['a.one'], retake: true, budget: 9 });
    expect(re.run.map((r) => [r.clip.id, r.take])).toEqual([['a.one', 2]]);
  });
  it('rejects unknown clip ids', () => {
    expect(() =>
      planSfx(spec, emptyManifest(), { only: ['nope'], retake: false, budget: 9 }),
    ).toThrow();
  });
});

describe('runSfx', () => {
  it('polls until done, saves the WAV and logs cost and output', async () => {
    const polls = ['running', 'completed'];
    const client = {
      post: () =>
        Promise.resolve({
          background_job_id: 'job1',
          quoted_generations: 1,
          sound_effect: { id: 's1' },
        }),
      get: () =>
        Promise.resolve({
          id: 's1',
          status: polls.shift(),
          audio_url: 'https://cdn/x.wav',
          duration_ms: 480,
        }),
      download: () => Promise.resolve(Buffer.from('RIFF')),
    } as unknown as PixelLabClient;
    const manifest = emptyManifest();
    const dir = await mkdtemp(join(tmpdir(), 'artgen-sfx-'));
    const spent = await runSfx(spec, {
      client,
      manifest,
      manifestPath: join(dir, 'manifest.json'),
      outRoot: dir,
      items: [{ clip: clipA, take: 1, cost: 1 }],
      log: () => undefined,
      sleep: () => Promise.resolve(),
    });
    expect(spent).toBe(1);
    expect(manifest.entries[0]).toMatchObject({
      endpoint: 'sound-effects',
      status: 'completed',
      cost: { generations: 1 },
      extra: { soundEffectId: 's1', durationMs: 480 },
      outputs: [{ index: 1, review: 'pending' }],
    });
    expect(await readFile(join(dir, 't', 'a.one-1.wav'), 'utf8')).toBe('RIFF');
    await rm(dir, { recursive: true, force: true });
  });
});

describe('sprite', () => {
  it('picks the approved take, else the newest', () => {
    const m: Manifest = {
      version: 1,
      entries: [take('a.one', 1, 'approved'), take('a.one', 2), take('b.two', 1), take('b.two', 2)],
    };
    expect(pickTakes(spec, m).map((p) => [p.entryId, p.reviewed])).toEqual([
      ['t/a.one/take-1', true],
      ['t/b.two/take-2', false],
    ]);
    expect(() => pickTakes(spec, emptyManifest())).toThrow(/no completed take/);
  });
  it('lays clips out with gaps and writes a typed module', () => {
    const slots = layoutSprite([100, 200, 50], 250);
    expect(slots).toEqual([
      [0, 100],
      [350, 200],
      [800, 50],
    ]);
    const ts = spriteModule(['a.one', 'b.two'], slots);
    expect(ts).toContain("'b.two': [350, 200],");
    expect(ts).toContain('export type SfxId = keyof typeof SFX_SPRITE;');
  });
});
