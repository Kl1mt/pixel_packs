/**
 * A tiny software framebuffer for the moment overlays: every pixel is one art px in a
 * palette colour, so the effects stay pixel art (GDD §16). Transparency is only ever
 * all-or-nothing; "half dark" is an ordered dither, never alpha blending.
 */
export class PixelBuffer {
  readonly data: Uint32Array;
  /** The same pixels as RGBA bytes, ready for `ImageData`. */
  readonly bytes: Uint8ClampedArray<ArrayBuffer>;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    const raw = new ArrayBuffer(w * h * 4);
    this.data = new Uint32Array(raw);
    this.bytes = new Uint8ClampedArray(raw);
  }

  clear(): void {
    this.data.fill(0);
  }

  set(x: number, y: number, c: number): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    this.data[yi * this.w + xi] = c;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x] ?? 0;
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++)
        this.data[yy * this.w + xx] = c;
  }
}

/** `#rrggbb` → an opaque pixel for `ImageData` (little-endian RGBA bytes). */
export function rgba(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** 4×4 ordered (Bayer) dither: whether pixel (x, y) is lit at coverage `level` ∈ [0, 1]. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export function dithered(x: number, y: number, level: number): boolean {
  if (level <= 0) return false;
  if (level >= 1) return true;
  const t = BAYER[(y & 3) * 4 + (x & 3)] ?? 0;
  return t < Math.round(level * 16);
}

/** Small seeded RNG (mulberry32), so a moment looks the same in every screenshot. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quantises a 0–1 value into `n` steps (stepped motion instead of smooth tweens). */
export const stepped = (k: number, n: number): number =>
  Math.min(1, Math.max(0, Math.floor(k * n) / n));

/** Pixels of a 1-px ring of radius `r` around (cx, cy) (midpoint circle). */
export function ringPixels(cx: number, cy: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  let x = Math.round(r);
  let y = 0;
  let err = 1 - x;
  while (x >= y) {
    for (const [dx, dy] of [
      [x, y],
      [y, x],
      [-y, x],
      [-x, y],
      [-x, -y],
      [-y, -x],
      [y, -x],
      [x, -y],
    ] as const)
      out.push([Math.round(cx) + dx, Math.round(cy) + dy]);
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
  return out;
}
