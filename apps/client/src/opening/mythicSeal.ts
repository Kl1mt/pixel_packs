import { MASTER_PALETTE as P } from '@pixel-packs/shared';
import { ringPixels } from './pixels.js';
import type { PackPixel } from './starhollow.js';

/** An inclusive rectangle in pack-local art px. */
export interface ArtRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Where the Mythic satchel's padlock and rune band sit (measured on the sprite). */
export interface SealArt {
  /** Box round the padlock; its warm (gold, brass) pixels and their ink are the lock. */
  lock: ArtRect;
  /** Rows of the rune band; its teal pixels outside the lock are the runes. */
  runes: ArtRect;
}

/** The lock opens at this tear progress (0–1 of the whole seam). */
export const UNLOCK_AT = 0.3;
/** The runes are all lit by here: the tear's breaking point (`TEAR_DONE`). */
export const RUNES_DONE = 0.8;
/** How long the opened padlock takes to drop off the satchel (ms). */
export const LOCK_FALL_MS = 520;

/** The three stages of the Mythic opening (GDD §7: lock → runes → burst). */
export interface SealStage {
  /** 0–1: how hard the padlock rattles before it gives. */
  rattle: number;
  unlocked: boolean;
  /** 0–1: share of rune glyphs alight. */
  lit: number;
}

export function sealStage(progress: number): SealStage {
  const p = Math.min(1, Math.max(0, progress));
  return {
    rattle: Math.min(1, p / UNLOCK_AT),
    unlocked: p >= UNLOCK_AT,
    lit: Math.min(1, Math.max(0, (p - UNLOCK_AT) / (RUNES_DONE - UNLOCK_AT))),
  };
}

/** One rune glyph: a connected cluster of teal pixels, lit as a whole. */
export interface Glyph {
  pixels: PackPixel[];
  /** Mean x, so glyphs can light outward from the lock. */
  cx: number;
}

export interface SealAnalysis {
  /** The padlock's own pixels (they move; the satchel stays). */
  lock: PackPixel[];
  /** What shows where the padlock was: plain velvet (the sigil is drawn on top). */
  hole: PackPixel[];
  /** Centre of the rune sigil the padlock hid. */
  sigil: { x: number; y: number };
  /** Rune glyphs in lighting order: nearest the lock first, alternating sides. */
  glyphs: Glyph[];
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * Reads the padlock and the runes off the sprite's RGBA pixels (`size`×`size`), so
 * any picked art works as long as the lock is warm-coloured and the runes teal.
 */
export function analyseSeal(data: ArrayLike<number>, size: number, art: SealArt): SealAnalysis {
  const at = (x: number, y: number) => {
    const i = (y * size + x) * 4;
    return {
      r: data[i] ?? 0,
      g: data[i + 1] ?? 0,
      b: data[i + 2] ?? 0,
      a: data[i + 3] ?? 0,
    };
  };
  const inRect = (r: ArtRect, x: number, y: number) =>
    x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const warm = (x: number, y: number) => {
    const c = at(x, y);
    return c.a > 0 && c.r > c.b + 10 && inRect(art.lock, x, y);
  };
  const dark = (x: number, y: number) => {
    const c = at(x, y);
    return c.a > 0 && c.r + c.g + c.b < 120;
  };
  const colour = (x: number, y: number) => {
    const c = at(x, y);
    return hex(c.r, c.g, c.b);
  };

  // The lock: warm pixels plus the dark outline and keyhole touching them.
  const isLock = new Set<number>();
  const { lock: L } = art;
  for (let y = L.y0; y <= L.y1; y++)
    for (let x = L.x0; x <= L.x1; x++) {
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx = 0, dy = 0]) => warm(x + dx, y + dy));
      if (warm(x, y) || (dark(x, y) && touches)) isLock.add(y * size + x);
    }
  // Behind the lock is plain velvet: the satchel colour most common round it.
  const counts = new Map<string, number>();
  for (let y = L.y0; y <= L.y1; y++)
    for (let x = L.x0; x <= L.x1; x++)
      if (!isLock.has(y * size + x) && at(x, y).a > 0) {
        const c = colour(x, y);
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
  const velvet = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#000000';
  const lock: PackPixel[] = [];
  const hole: PackPixel[] = [];
  for (const k of isLock) {
    const x = k % size;
    const y = Math.floor(k / size);
    lock.push({ x, y, colour: colour(x, y) });
    hole.push({ x, y, colour: velvet });
  }
  const xs = lock.map((p) => p.x);
  const ys = lock.map((p) => p.y);
  const top = Math.min(...ys);
  // The padlock's body is its lower two thirds; the sigil sits where its keyhole was.
  const sigil = {
    x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    y: Math.round(top + 0.65 * (Math.max(...ys) - top)),
  };

  // Runes: teal pixels (green and blue well above red) in the band, outside the lock.
  const isRune = (x: number, y: number) => {
    if (!inRect(art.runes, x, y) || isLock.has(y * size + x)) return false;
    const c = at(x, y);
    return c.a > 0 && c.g > c.r + 30 && c.b > c.r + 20;
  };
  const seen = new Set<number>();
  const glyphs: Glyph[] = [];
  for (let y = art.runes.y0; y <= art.runes.y1; y++)
    for (let x = art.runes.x0; x <= art.runes.x1; x++) {
      if (seen.has(y * size + x) || !isRune(x, y)) continue;
      const pixels: PackPixel[] = [];
      const stack = [[x, y] as const];
      seen.add(y * size + x);
      while (stack.length > 0) {
        const [px, py] = stack.pop() ?? [0, 0];
        pixels.push({ x: px, y: py, colour: colour(px, py) });
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx;
            const ny = py + dy;
            if (seen.has(ny * size + nx) || !isRune(nx, ny)) continue;
            seen.add(ny * size + nx);
            stack.push([nx, ny]);
          }
      }
      glyphs.push({ pixels, cx: pixels.reduce((s, p) => s + p.x, 0) / pixels.length });
    }
  const mid = (L.x0 + L.x1) / 2;
  glyphs.sort((a, b) => Math.abs(a.cx - mid) - Math.abs(b.cx - mid));
  return { lock, hole, glyphs, sigil };
}

/**
 * The lit runes (stage 2). Glyph `i` lights once `lit` passes its share; the newest
 * flares white for a moment. During the burst they fling outwards as sparks.
 */
export function runePixels(
  glyphs: readonly Glyph[],
  lit: number,
  clockMs: number,
  burst: number | null,
  centre: { x: number; y: number },
): PackPixel[] {
  const out: PackPixel[] = [];
  const n = Math.round(lit * glyphs.length);
  glyphs.slice(0, n).forEach((g, i) => {
    // Lit runes flicker between two golds; the newest flares white.
    const gold = (i + Math.floor(clockMs / 140)) % 3 === 0 ? P.sunflower : P.glow;
    for (const p of g.pixels) {
      if (burst === null) {
        out.push({ ...p, colour: i === n - 1 && lit < 1 ? P.glow : gold });
        continue;
      }
      // The glyph burns white while sparks fly from it, fewer each step of the burst.
      out.push({ ...p, colour: P.glow });
      if ((p.x + p.y) % 4 < burst * 4) continue;
      const dx = p.x - centre.x;
      const dy = p.y - centre.y;
      const len = Math.hypot(dx, dy) || 1;
      const fly = burst * 26;
      out.push({
        x: Math.round(p.x + (dx / len) * fly),
        y: Math.round(p.y + (dy / len) * fly - burst * 8),
        colour: (p.x + p.y) % 2 === 0 ? P.sunflower : P.seafoam,
      });
    }
  });
  return out;
}

/**
 * The rune sigil the padlock hid: an inked ring with an elk-sedge rune inside. It
 * shows teal once the lock is gone and burns gold while the runes are alight.
 */
export function sigilPixels(
  c: { x: number; y: number },
  lit: boolean,
  flare: boolean,
): PackPixel[] {
  const out: PackPixel[] = [];
  const ink = P.ink;
  const line = flare ? P.glow : lit ? P.sunflower : P.seafoam;
  const fill = lit ? P.night : P.tealDeep;
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 6.4) continue;
      // An elk-sedge rune: a stem with two arms reaching up.
      const rune = dx === 0 ? Math.abs(dy) <= 3 : Math.abs(dx) <= 2 && dy === -Math.abs(dx);
      const colour = d > 5.4 ? ink : d > 4.4 || rune ? line : fill;
      out.push({ x: c.x + dx, y: c.y + dy, colour });
    }
  return out;
}

/**
 * Where the padlock is drawn: rattling (stage 1), then once open it jumps, then drops
 * off the satchel with gravity. Returns null when it has fallen out of view.
 */
export function lockOffset(
  stage: SealStage,
  sinceUnlockMs: number | null,
  clockMs: number,
  reduced: boolean,
): { x: number; y: number } | null {
  if (!stage.unlocked || sinceUnlockMs === null) {
    if (reduced || stage.rattle === 0) return { x: 0, y: 0 };
    // Rattles faster and wider as the seam tears towards the lock giving.
    const period = Math.round(260 - 180 * stage.rattle);
    const on = clockMs % period < period / 2;
    return { x: on ? (stage.rattle > 0.6 ? 2 : 1) : stage.rattle > 0.6 ? -1 : 0, y: 0 };
  }
  if (reduced) return null;
  const t = sinceUnlockMs / LOCK_FALL_MS;
  if (t >= 1) return null;
  // A small hop up, then gravity.
  return {
    x: Math.round(t * 3),
    y: Math.round(-3 * Math.sin(Math.min(1, t * 3) * Math.PI) + 60 * t * t),
  };
}

/**
 * The Mythic pack's staged seal on the tear canvas: owns the sprite without its
 * padlock (`body`), and tracks when the lock opened. `TearScene` draws the rest.
 */
export class MythicSeal {
  readonly body: HTMLCanvasElement;
  private readonly seal: SealAnalysis;
  private unlockedAt: number | null = null;

  constructor(img: HTMLImageElement, art: SealArt, size: number) {
    this.body = document.createElement('canvas');
    this.body.width = size;
    this.body.height = size;
    const ctx = this.body.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(img, 0, 0);
    this.seal = analyseSeal(ctx.getImageData(0, 0, size, size).data, size, art);
    for (const p of this.seal.hole) {
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
  }

  /** Pack-local pixels of the padlock and the runes at tear `progress`. */
  pixels(progress: number, clockMs: number, burst: number | null, reduced: boolean): PackPixel[] {
    const stage = sealStage(burst === null ? progress : 1);
    if (stage.unlocked && this.unlockedAt === null) this.unlockedAt = clockMs;
    const since = this.unlockedAt === null ? null : clockMs - this.unlockedAt;
    const { sigil } = this.seal;
    const out = runePixels(this.seal.glyphs, stage.lit, clockMs, reduced ? null : burst, sigil);
    if (stage.unlocked) out.push(...sigilPixels(sigil, stage.lit > 0, burst !== null));
    // The burst: a gold shockwave rolls out of the sigil, thinning as it grows.
    if (burst !== null && !reduced)
      ringPixels(sigil.x, sigil.y, Math.round(7 + burst * 38)).forEach(([x, y], i) => {
        if (i % 3 < burst * 3) return;
        out.push({ x, y, colour: i % 2 === 0 ? P.sunflower : P.glow });
      });
    const off = lockOffset(stage, since, clockMs, reduced);
    if (off) for (const p of this.seal.lock) out.push({ ...p, x: p.x + off.x, y: p.y + off.y });
    // The keyhole glints as it gives.
    if (since !== null && since < 160 && !reduced)
      for (const [dx, dy] of [
        [0, -2],
        [0, 2],
        [-2, 0],
        [2, 0],
        [0, 0],
      ] as const)
        out.push({ x: sigil.x + dx, y: sigil.y + dy, colour: P.glow });
    return out;
  }
}
