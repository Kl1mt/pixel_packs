import { MASTER_PALETTE as P } from '@pixel-packs/shared';
import { dithered, ringPixels, rgba, seeded, stepped, type PixelBuffer } from './pixels.js';

/** The palette as framebuffer pixels. */
export const C = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, rgba(v)])) as Record<
  keyof typeof P,
  number
>;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Darkens the screen with an ordered dither of `colour` (0 = clear, 1 = solid). */
export function dim(buf: PixelBuffer, level: number, colour = C.ink): void {
  if (level <= 0) return;
  for (let y = 0; y < buf.h; y++)
    for (let x = 0; x < buf.w; x++) if (dithered(x, y, level)) buf.data[y * buf.w + x] = colour;
}

/**
 * Golden god-rays fanning down from a point above the card (Legendary, §5): hard
 * wedges in two golds that turn slowly, reaching `reach` art px, thinning with distance.
 */
export function godRays(
  buf: PixelBuffer,
  src: { x: number; y: number },
  reach: number,
  turn: number,
  strength: number,
): void {
  const n = 7;
  for (let y = Math.max(0, Math.floor(src.y)); y < buf.h; y++)
    for (let x = 0; x < buf.w; x++) {
      const dx = x - src.x;
      const dy = y - src.y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 2) continue;
      const a = Math.atan2(dy, dx);
      if (a < 0.15 || a > Math.PI - 0.15) continue;
      const f = ((((a / Math.PI) * n + turn) % 1) + 1) % 1;
      if (f > 0.36) continue;
      const fade = strength * (1 - d / reach) ** 1.4;
      if (!dithered(x, y, fade * 1.3)) continue;
      buf.data[y * buf.w + x] = f < 0.1 ? C.glow : f < 0.24 ? C.sunflower : C.amber;
    }
}

/** A stepped shockwave ring (3 px: glow, colour, dark edge). */
export function shockRing(
  buf: PixelBuffer,
  c: { x: number; y: number },
  r: number,
  colour: number,
): void {
  if (r < 1) return;
  const rings: [number, number][] = [
    [r, C.glow],
    [r - 1, colour],
    [r - 2, colour],
    [r + 1, C.indigo],
  ];
  for (const [rr, col] of rings)
    if (rr > 0) for (const [x, y] of ringPixels(c.x, c.y, rr)) buf.set(x, y, col);
}

/** Mythic shockwave: a white flash, then two rings race out trailing a dithered wake. */
export function shockwave(buf: PixelBuffer, k: number): void {
  const c = { x: buf.w / 2, y: buf.h / 2 };
  dim(buf, 1, C.night);
  if (k < 0.15) dim(buf, 1 - k / 0.15, C.glow);
  const far = Math.hypot(buf.w, buf.h) / 2;
  const outer = Math.round(4 + k * far * 1.1);
  const inner = Math.round(k * far * 0.7);
  for (let y = 0; y < buf.h; y++)
    for (let x = 0; x < buf.w; x++) {
      const d = Math.hypot(x - c.x, y - c.y);
      const wake = outer - d;
      if (wake > 0 && wake < 24 && dithered(x, y, 0.5 * (1 - wake / 24)))
        buf.data[y * buf.w + x] = C.lilac;
    }
  shockRing(buf, c, outer, C.rose);
  shockRing(buf, c, inner, C.sunflower);
  const rnd = seeded(31);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const d = (0.3 + rnd() * 0.7) * outer;
    sparkle(buf, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, rnd() < 0.3 ? 1 : 0, C.sunflower);
  }
}

/** A four-point sparkle of arm length `size`. */
export function sparkle(
  buf: PixelBuffer,
  x: number,
  y: number,
  size: number,
  colour = C.glow,
): void {
  buf.set(x, y, C.glow);
  for (let i = 1; i <= size; i++) {
    const col = i === size ? colour : C.glow;
    buf.set(x + i, y, col);
    buf.set(x - i, y, col);
    buf.set(x, y + i, col);
    buf.set(x, y - i, col);
  }
}

/** Foil stinger: one wide glint sweeps diagonally across the card, a sparkle pops at its corner. */
export function foilGlint(buf: PixelBuffer, card: Rect, k: number): void {
  const span = card.w + card.h;
  const front = -24 + stepped(k, 16) * (span + 48);
  for (let y = card.y; y < card.y + card.h; y++)
    for (let x = card.x; x < card.x + card.w; x++) {
      const d = front - (x - card.x + (y - card.y));
      if (d < 0 || d > 14) continue;
      const col = d < 3 ? C.glow : d < 8 ? C.moonlight : C.silver;
      if (d < 8 || dithered(x, y, 0.5)) buf.data[y * buf.w + x] = col;
    }
  const pop = Math.round(Math.sin(Math.min(1, Math.max(0, (k - 0.45) / 0.5)) * Math.PI) * 6);
  if (pop > 0) sparkle(buf, card.x + card.w - 6, card.y + 6, pop, C.sunflower);
}

const RAINBOW = [C.rose, C.amber, C.sunflower, C.sprout, C.seafoam, C.periwinkle, C.lilac];

/** Prismatic stinger: stepped rainbow bands wash across the whole screen, half-dithered. */
export function rainbowWash(buf: PixelBuffer, card: Rect, k: number, t: number): void {
  const band = 7;
  const width = RAINBOW.length * band;
  const front = -width + stepped(k, 24) * (buf.w + buf.h + width * 2);
  for (let y = 0; y < buf.h; y++)
    for (let x = 0; x < buf.w; x++) {
      const d = front - (x + y * 0.6);
      if (d < 0 || d >= width) continue;
      if (!dithered(x, y, 0.5)) continue;
      buf.data[y * buf.w + x] = RAINBOW[Math.floor(d / band)] ?? C.glow;
    }
  const rnd = seeded(41 + Math.floor(t / 140));
  for (let i = 0; i < 10; i++)
    sparkle(
      buf,
      card.x + rnd() * card.w,
      card.y + rnd() * card.h,
      1 + Math.floor(rnd() * 2),
      RAINBOW[i % 7],
    );
}

/** Void stinger (dark on `under`, the rest over the card): the dark closes in, stars rush into the card's heart, a ring collapses, then a pop. */
export function voidImplosion(under: PixelBuffer, buf: PixelBuffer, card: Rect, k: number): void {
  const c = centre(card);
  const pull = Math.min(1, k / 0.65);
  dim(under, k < 0.65 ? 0.25 + pull * 0.4 : 0.65 * (1 - (k - 0.65) / 0.35), C.night);
  const rnd = seeded(77);
  const far = Math.hypot(buf.w, buf.h) / 2;
  if (k < 0.65)
    for (let i = 0; i < 150; i++) {
      const a = rnd() * Math.PI * 2;
      const d0 = 30 + rnd() * far;
      const d = d0 * (1 - pull ** 2);
      const spin = a + pull * 1.6;
      const x = c.x + Math.cos(spin) * d;
      const y = c.y + Math.sin(spin) * d;
      buf.set(x, y, i % 3 === 0 ? C.lavender : i % 3 === 1 ? C.lilac : C.moonlight);
      if (i % 4 === 0) buf.set(x - Math.cos(spin) * 1, y - Math.sin(spin) * 1, C.periwinkle);
    }
  if (k < 0.7) shockRing(buf, c, Math.round((1 - pull) * 70), C.lilac);
  if (k >= 0.62 && k < 0.8)
    sparkle(buf, c.x, c.y, Math.round(10 * (1 - Math.abs(k - 0.71) / 0.09)), C.lavender);
  if (k >= 0.72) {
    const out = (k - 0.72) / 0.28;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const d = 6 + out * 40;
      if (dithered(i, i * 3, 1 - out))
        buf.set(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, i % 2 ? C.lavender : C.glow);
    }
  }
}

/**
 * Glitch stinger: the screen tears into offset bands of broken colour, blocks of noise
 * swap in and out, and an RGB split runs down the card edges. `frame` re-rolls the noise.
 */
export function glitchNoise(buf: PixelBuffer, card: Rect, k: number, frame: number): void {
  const rnd = seeded(1500 + frame);
  const burst = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
  const bands = Math.round(6 * burst);
  for (let i = 0; i < bands; i++) {
    const y = Math.floor(rnd() * buf.h);
    const h = 1 + Math.floor(rnd() * 5);
    const x = Math.floor(rnd() * buf.w * 0.6);
    const w = 20 + Math.floor(rnd() * buf.w * 0.5);
    const col = [C.seafoam, C.rose, C.ink, C.night, C.lavender][i % 5] ?? C.ink;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (dithered(xx, yy, i % 2 ? 1 : 0.5)) buf.set(xx, yy, col);
  }
  for (let i = 0; i < Math.round(14 * burst); i++) {
    const bx = Math.floor(rnd() * (buf.w / 8)) * 8;
    const by = Math.floor(rnd() * (buf.h / 8)) * 8;
    const col = rnd() < 0.5 ? C.ink : rnd() < 0.5 ? C.seafoam : C.berry;
    for (let yy = 0; yy < 8; yy++)
      for (let xx = 0; xx < 8; xx++)
        if ((xx + yy + frame) % 3 !== 0) buf.set(bx + xx, by + yy, col);
  }
  if (burst > 0)
    for (let y = card.y; y < card.y + card.h; y++) {
      const jitter = rnd() < 0.15 ? Math.round((rnd() - 0.5) * 6) : 0;
      buf.set(card.x - 2 + jitter, y, C.rose);
      buf.set(card.x + card.w + 1 + jitter, y, C.seafoam);
    }
}
