import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { findEntry, type Manifest } from '../manifest.js';
import { fromRepo } from '../paths.js';
import { decodePng, imageStats } from '../png.js';
import { encodeApng, type ApngFrame } from './apng.js';
import { blank, blit } from './preview.js';
import type { CharacterSpec } from './spec.js';

/**
 * Mock battle lane (T17 view comparison): two critters on one ground line, the
 * left one facing east, the right one the east sprite mirrored (as enemies are,
 * GDD §19), playing idle → walk → attack/hurt at the game's 3× card scale.
 * Frames are placed by an anchor (idle frame 1: bbox centre x, bottom row), so any
 * baseline drift inside an animation stays visible.
 */

type Anim = 'idle' | 'walk' | 'attack' | 'hurt';
type Timeline = [Anim, number][];

/** 40 ticks: both idle, both walk in place, left attacks (right hurt), right attacks (left hurt). */
export const LEFT_TIMELINE: Timeline = [
  ['idle', 8],
  ['walk', 12],
  ['attack', 6],
  ['idle', 7],
  ['hurt', 4],
  ['idle', 3],
];
export const RIGHT_TIMELINE: Timeline = [
  ['idle', 8],
  ['walk', 12],
  ['idle', 3],
  ['hurt', 4],
  ['idle', 3],
  ['attack', 6],
  ['idle', 4],
];

const GROUND: [number, number, number] = [120, 96, 80];

export function mirror(src: PNG): PNG {
  const out = new PNG({ width: src.width, height: src.height });
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const j = (y * src.width + (src.width - 1 - x)) * 4;
      out.data.set(src.data.subarray(i, i + 4), j);
    }
  }
  return out;
}

/** The animation (and frame within it) a timeline plays at `tick`. */
export function timelineAt(timeline: Timeline, tick: number): { anim: Anim; frame: number } {
  let t = tick;
  for (const [anim, len] of timeline) {
    if (t < len) return { anim, frame: t };
    t -= len;
  }
  const last = timeline[timeline.length - 1];
  return { anim: last?.[0] ?? 'idle', frame: 0 };
}

export function timelineLength(timeline: Timeline): number {
  return timeline.reduce((s, [, n]) => s + n, 0);
}

type Frames = Record<Anim, PNG[]>;

async function eastFrames(spec: CharacterSpec, manifest: Manifest, character: string) {
  const out: Partial<Frames> = {};
  for (const anim of ['idle', 'walk', 'attack', 'hurt'] as const) {
    const job = spec.animations.find(
      (a) => a.character === character && a.name === anim && a.direction === 'east',
    );
    const entry = job && findEntry(manifest, `${spec.id}/${job.id}`);
    const files = (entry?.outputs ?? []).map((o) => o.file).filter((f) => /\/\d\d\.png$/.test(f));
    if (files.length === 0) throw new Error(`${character} has no east ${anim}`);
    out[anim] = await Promise.all(files.map(async (f) => decodePng(await readFile(fromRepo(f)))));
  }
  return out as Frames;
}

function anchor(png: PNG) {
  const b = imageStats(png).bbox;
  if (!b) throw new Error('empty frame');
  return { x: Math.round((b.x0 + b.x1) / 2), y: b.y1 };
}

export interface LaneSide {
  frames: Frames;
  flip: boolean;
}

/** Renders one lane's ticks as images (art px × scale). */
export function laneImages(left: LaneSide, right: LaneSide, scale = 3): PNG[] {
  const width = 200;
  const height = 96;
  const groundY = 84;
  const spots = [60, 140];
  const sides = [left, right].map((s) => {
    const frames = s.flip
      ? (Object.fromEntries(Object.entries(s.frames).map(([k, v]) => [k, v.map(mirror)])) as Frames)
      : s.frames;
    const base = frames.idle[0];
    if (!base) throw new Error('no idle frame');
    return { frames, anchor: anchor(base) };
  });
  const ticks = timelineLength(LEFT_TIMELINE);
  const images: PNG[] = [];
  for (let t = 0; t < ticks; t++) {
    const img = blank(width * scale, height * scale);
    for (let x = 0; x < width * scale; x++) {
      for (let dy = 0; dy < scale; dy++) {
        img.data.set([...GROUND, 255], ((groundY + 1) * scale + dy) * img.width * 4 + x * 4);
      }
    }
    [LEFT_TIMELINE, RIGHT_TIMELINE].forEach((tl, n) => {
      const side = sides[n];
      const spot = spots[n];
      if (!side || spot === undefined) return;
      const { anim, frame } = timelineAt(tl, t);
      const list = side.frames[anim];
      const f = list[frame % list.length];
      if (!f) return;
      blit(img, f, (spot - side.anchor.x) * scale, (groundY - side.anchor.y) * scale, scale);
    });
    images.push(img);
  }
  return images;
}

/** Stacks lanes vertically (same tick count) with a gap. */
export function stackLanes(lanes: PNG[][], gap = 12): PNG[] {
  const first = lanes[0]?.[0];
  if (!first) throw new Error('no lanes');
  return (lanes[0] ?? []).map((_, t) => {
    const img = blank(first.width, lanes.length * (first.height + gap) - gap);
    lanes.forEach((lane, r) => {
      const src = lane[t];
      if (src) blit(img, src, 0, r * (first.height + gap), 1);
    });
    return img;
  });
}

export function laneApng(images: PNG[], tickMs = 120): Buffer {
  const frames: ApngFrame[] = images.map((image) => ({ image, delayMs: tickMs }));
  return encodeApng(frames);
}

/** Lane for one view: `left` and `right` are character job ids of the spec. */
export async function viewLane(
  spec: CharacterSpec,
  manifest: Manifest,
  left: string,
  right: string,
): Promise<PNG[]> {
  const l = await eastFrames(spec, manifest, left);
  const r = await eastFrames(spec, manifest, right);
  return laneImages({ frames: l, flip: false }, { frames: r, flip: true });
}
