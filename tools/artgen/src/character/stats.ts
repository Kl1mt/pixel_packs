import { readFile } from 'node:fs/promises';
import { findEntry, type Manifest } from '../manifest.js';
import { fromRepo } from '../paths.js';
import { decodePng, imageStats } from '../png.js';
import type { CharacterSpec } from './spec.js';

export interface AnimationStats {
  id: string;
  frames: number;
  size: string;
  /** Bottom opaque row per frame (feet baseline). */
  baselines: number[];
  /** Opaque bbox width and height ranges across frames. */
  bboxW: [number, number];
  bboxH: [number, number];
  colours: number;
  touchesEdge: boolean;
}

/** Consistency numbers for every finished animation of a character spec. */
export async function animationStats(
  spec: CharacterSpec,
  manifest: Manifest,
): Promise<AnimationStats[]> {
  const out: AnimationStats[] = [];
  for (const a of spec.animations) {
    const entry = findEntry(manifest, `${spec.id}/${a.id}`);
    if (entry?.status !== 'completed') continue;
    const files = entry.outputs.map((o) => o.file).filter((f) => /\/\d\d\.png$/.test(f));
    const pngs = await Promise.all(files.map(async (f) => decodePng(await readFile(fromRepo(f)))));
    const stats = pngs.map((p) => imageStats(p));
    const colours = new Set<number>();
    for (const p of pngs) {
      for (let i = 0; i < p.data.length; i += 4) {
        if ((p.data[i + 3] ?? 0) > 0) colours.add(p.data.readUInt32BE(i));
      }
    }
    const ws = stats.map((s) => (s.bbox ? s.bbox.x1 - s.bbox.x0 + 1 : 0));
    const hs = stats.map((s) => (s.bbox ? s.bbox.y1 - s.bbox.y0 + 1 : 0));
    out.push({
      id: a.id,
      frames: pngs.length,
      size: `${String(pngs[0]?.width)}x${String(pngs[0]?.height)}`,
      baselines: stats.map((s) => s.bbox?.y1 ?? -1),
      bboxW: [Math.min(...ws), Math.max(...ws)],
      bboxH: [Math.min(...hs), Math.max(...hs)],
      colours: colours.size,
      touchesEdge: stats.some((s) => s.touchesEdge),
    });
  }
  return out;
}
