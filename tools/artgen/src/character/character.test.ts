import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { emptyManifest } from '../manifest.js';
import { fromRepo } from '../paths.js';
import { crc32, encodeApng } from './apng.js';
import { bottomRow } from './preview.js';
import { animationBody, characterBody, planCharacterJobs } from './run.js';
import { CharacterSpecSchema, loadCharacterSpec } from './spec.js';

function solid(w: number, h: number, rgba: number[]): PNG {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set(rgba, i * 4);
  return png;
}

describe('apng', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(Buffer.from('IEND', 'ascii'))).toBe(0xae426082);
  });

  it('encodes a looping APNG whose default image is frame 1', () => {
    const red = solid(3, 2, [255, 0, 0, 255]);
    const blue = solid(3, 2, [0, 0, 255, 128]);
    const buf = encodeApng([
      { image: red, delayMs: 100 },
      { image: blue, delayMs: 100 },
    ]);
    const types: string[] = [];
    for (let o = 8; o < buf.length;) {
      const len = buf.readUInt32BE(o);
      types.push(buf.toString('ascii', o + 4, o + 8));
      o += 12 + len;
    }
    expect(types).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'IEND']);
    expect(buf.readUInt32BE(8 + 8 + 13 + 4 + 8)).toBe(2); // acTL num_frames
    const decoded = PNG.sync.read(buf);
    expect([...decoded.data.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it('rejects frames of different sizes', () => {
    expect(() =>
      encodeApng([
        { image: solid(2, 2, [0, 0, 0, 255]), delayMs: 1 },
        { image: solid(3, 2, [0, 0, 0, 255]), delayMs: 1 },
      ]),
    ).toThrow();
  });
});

describe('preview', () => {
  it('finds the bottom opaque row', () => {
    const png = solid(4, 4, [0, 0, 0, 0]);
    png.data[(2 * 4 + 1) * 4 + 3] = 255;
    expect(bottomRow(png)).toBe(2);
    expect(bottomRow(solid(2, 2, [0, 0, 0, 0]))).toBe(-1);
  });
});

describe('t17 spec', () => {
  it('loads and plans within the budget (1 per call at 64 px)', async () => {
    const spec = await loadCharacterSpec(fromRepo('tools/artgen/specs/t17.json'));
    expect(spec.characters).toHaveLength(4);
    expect(spec.animations).toHaveLength(20);
    const plan = planCharacterJobs(spec, emptyManifest(), [], 30);
    expect(plan.planned).toBe(24);
    expect(planCharacterJobs(spec, emptyManifest(), [], 5).run).toHaveLength(5);
  });

  it('rejects odd v3 frame counts and unknown characters', () => {
    const base = {
      id: 'x',
      characters: [{ id: 'c', cardId: 'MOS-012', view: 'side', seed: 1, outDir: 'o' }],
    };
    const anim = {
      id: 'a',
      character: 'c',
      name: 'idle',
      direction: 'east',
      frameCount: 4,
      action: 'idle',
      seed: 1,
      outDir: 'o',
    };
    expect(CharacterSpecSchema.safeParse({ ...base, animations: [anim] }).success).toBe(true);
    expect(
      CharacterSpecSchema.safeParse({ ...base, animations: [{ ...anim, frameCount: 5 }] }).success,
    ).toBe(false);
    expect(
      CharacterSpecSchema.safeParse({ ...base, animations: [{ ...anim, character: 'z' }] }).success,
    ).toBe(false);
  });

  it('builds request bodies with the card prompt, constraints and realm palette', async () => {
    const spec = await loadCharacterSpec(fromRepo('tools/artgen/specs/t17.json'));
    const char = spec.characters[0];
    const anim = spec.animations[0];
    if (!char || !anim) throw new Error('empty spec');
    const ref = await readFile(fromRepo(`apps/client/public/assets/cards/${char.cardId}.png`));
    const cb = characterBody(char, ref.toString('base64'));
    expect(cb.description).toMatch(/^Grandmother Morel: /);
    expect(cb.n_directions).toBe(4);
    const ab = animationBody(spec, anim, 'char-1');
    expect(ab.directions).toEqual([anim.direction]);
    expect(ab.action_description).toContain(spec.animationConstraints);
    expect(ab.target_palette?.colors.length).toBeGreaterThanOrEqual(8);
    expect(ab.keep_first_frame).toBe(false);
  });
});
