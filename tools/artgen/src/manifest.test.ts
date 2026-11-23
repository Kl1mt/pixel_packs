import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readManifest, setReview, totalSpend, writeManifest, type Manifest } from './manifest.js';

const manifest = (): Manifest => ({
  version: 1,
  entries: [
    {
      id: 's/a',
      spec: 's',
      job: 'a',
      endpoint: 'generate-image-v2',
      params: { description: 'x' },
      seed: 1,
      status: 'completed',
      cost: { generations: 10, usd: 0.08 },
      createdAt: '2026-11-23T00:00:00Z',
      outputs: [{ index: 1, file: 'a/01.png', review: 'pending' }],
    },
    {
      id: 's/b/failed-1',
      spec: 's',
      job: 'b',
      endpoint: 'generate-image-v2',
      params: {},
      seed: 2,
      status: 'failed',
      cost: { generations: 0 },
      createdAt: '2026-11-23T00:00:00Z',
      outputs: [],
    },
  ],
});

describe('manifest', () => {
  it('sums the spend', () => {
    expect(totalSpend(manifest())).toBe(10);
  });

  it('sets and clears reviews', () => {
    const m = manifest();
    expect(setReview(m, 's/a', 1, 'approved', 'anchor')).toBe(true);
    expect(m.entries[0]?.outputs[0]).toMatchObject({ review: 'approved', note: 'anchor' });
    expect(setReview(m, 's/a', 1, 'pending')).toBe(true);
    expect(m.entries[0]?.outputs[0]?.note).toBeUndefined();
    expect(setReview(m, 's/a', 2, 'approved')).toBe(false);
    expect(setReview(m, 'nope', 1, 'approved')).toBe(false);
  });

  it('round-trips through disk and reads a missing file as empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'artgen-'));
    const path = join(dir, 'manifest.json');
    expect(await readManifest(path)).toEqual({ version: 1, entries: [] });
    await writeManifest(manifest(), path);
    expect(await readManifest(path)).toEqual(manifest());
    expect((await readFile(path, 'utf8')).endsWith('\n')).toBe(true);
  });
});
