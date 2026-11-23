import type { Realm } from '@pixel-packs/shared';
import { C, dim, sparkle, type Rect } from './momentFx.js';
import { dithered, ringPixels, rgba, seeded, stepped, type PixelBuffer } from './pixels.js';

/** One opaque sprite pixel, relative to the sprite's top-left. */
export interface SpritePixel {
  x: number;
  y: number;
  c: number;
}

export interface Sprite {
  w: number;
  h: number;
  pixels: SpritePixel[];
}

/** The opaque pixels of a loaded image (the art is already in palette colours). */
export function spriteFrom(img: HTMLImageElement): Sprite | null {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx || c.width === 0) return null;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const pixels: SpritePixel[] = [];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if ((d[i + 3] ?? 0) < 128) continue;
      const hex = `#${[d[i], d[i + 1], d[i + 2]].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`;
      pixels.push({ x, y, c: rgba(hex) });
    }
  return trimmed(pixels);
}

/** Crops a sprite to its opaque pixels, so it can stand on the ground by its real feet. */
function trimmed(pixels: SpritePixel[]): Sprite | null {
  if (pixels.length === 0) return null;
  const x0 = Math.min(...pixels.map((p) => p.x));
  const y0 = Math.min(...pixels.map((p) => p.y));
  const w = Math.max(...pixels.map((p) => p.x)) - x0 + 1;
  const h = Math.max(...pixels.map((p) => p.y)) - y0 + 1;
  return { w, h, pixels: pixels.map((p) => ({ ...p, x: p.x - x0, y: p.y - y0 })) };
}

export function drawSprite(buf: PixelBuffer, s: Sprite, x: number, y: number): void {
  for (const p of s.pixels) buf.set(x + p.x, y + p.y, p.c);
}

/** The art the moments use, per realm (missing art falls back to shapes drawn in code). */
export interface RealmArt {
  crest: Sprite | null;
  /** The subject of the Mythic mini-cutscene (Umbra asleep / the Hollow Stump). */
  vignette: Sprite | null;
}

/** A crest drawn in code: a ringed medallion with a leaf (Mossgrove) or a crescent (Starhollow). */
export function fallbackCrest(realm: Realm): Sprite {
  const pixels: SpritePixel[] = [];
  const mossy = realm === 'mossgrove';
  const rim = mossy ? C.oak : C.silver;
  const face = mossy ? C.moss : C.indigo;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5);
      if (d > 15) continue;
      let c = d > 14 ? C.ink : d > 12 ? rim : face;
      if (mossy) {
        // A leaf: a lens shape tilted on the diagonal, with a midrib.
        const u = (x - 15.5 + (y - 15.5)) / Math.SQRT2;
        const v = (x - 15.5 - (y - 15.5)) / Math.SQRT2;
        if (Math.abs(v) < 5 * (1 - (u / 10) ** 2) && Math.abs(u) < 10)
          c = Math.abs(v) < 0.8 ? C.leaf : v < 0 ? C.sprout : C.lichen;
      } else if (d < 9 && Math.hypot(x - 19, y - 13) > 7) c = d > 8 ? C.silver : C.moonlight;
      pixels.push({ x, y, c });
    }
  return { w: 32, h: 32, pixels };
}

/** Crest burst (§5): the crest flashes in over the card, then flies apart into its own pixels. */
export function crestBurst(
  buf: PixelBuffer,
  crest: Sprite,
  at: { x: number; y: number },
  k: number,
): void {
  const ox = Math.round(at.x - crest.w / 2);
  const oy = Math.round(at.y - crest.h / 2);
  if (k < 0.3) {
    for (const [x, y] of ringPixels(at.x, at.y, crest.w / 2 + 3 + stepped(k / 0.3, 4) * 6))
      buf.set(x, y, C.sunflower);
    drawSprite(buf, crest, ox, oy);
    return;
  }
  const out = (k - 0.3) / 0.7;
  const rnd = seeded(5);
  for (const p of crest.pixels) {
    const dx = p.x - crest.w / 2 + (rnd() - 0.5) * 3;
    const dy = p.y - crest.h / 2 + (rnd() - 0.5) * 3;
    const s = 1 + out * (2.5 + rnd() * 3);
    if (!dithered(p.x, p.y, 1 - out * out)) continue;
    buf.set(at.x + dx * s, at.y + dy * s + out * out * 10, p.c);
  }
}

/** The cutscene window (a letterboxed panel in the middle of the screen). */
export function cutsceneWindow(buf: PixelBuffer): Rect {
  const w = Math.min(buf.w - 8, 176);
  const h = Math.min(buf.h - 8, 112);
  return { x: Math.floor((buf.w - w) / 2), y: Math.floor((buf.h - h) / 2), w, h };
}

function frameWindow(buf: PixelBuffer, r: Rect, rim: number): void {
  for (let x = r.x - 2; x < r.x + r.w + 2; x++)
    for (const y of [r.y - 2, r.y - 1, r.y + r.h, r.y + r.h + 1])
      buf.set(x, y, y === r.y - 1 || y === r.y + r.h ? rim : C.ink);
  for (let y = r.y - 2; y < r.y + r.h + 2; y++)
    for (const x of [r.x - 2, r.x - 1, r.x + r.w, r.x + r.w + 1])
      buf.set(x, y, x === r.x - 1 || x === r.x + r.w ? rim : C.ink);
}

/** Rolling hills along the bottom of the window. */
function hills(buf: PixelBuffer, r: Rect, top: number, body: number, edge: number): number {
  const ground = r.y + r.h - 18;
  for (let x = r.x; x < r.x + r.w; x++) {
    const hgt = Math.round(3 * Math.sin((x - r.x) / 14) + 2 * Math.sin((x - r.x) / 5.5));
    for (let y = ground + hgt; y < r.y + r.h; y++)
      buf.set(x, y, y === ground + hgt ? edge : y < ground + hgt + 2 ? top : body);
  }
  return ground;
}

/** Starhollow: the moon is swallowed by an eclipse above Umbra, asleep in the Hollow (§3, §5). */
function eclipse(
  buf: PixelBuffer,
  r: Rect,
  k: number,
  t: number,
  still: boolean,
  art: RealmArt,
): void {
  // Night above, a dithered glow of indigo and periwinkle down to the horizon.
  for (let y = r.y; y < r.y + r.h; y++) {
    const band = (y - r.y) / r.h;
    const a = Math.min(1, Math.max(0, (band - 0.3) / 0.3));
    const b = Math.min(1, Math.max(0, (band - 0.62) / 0.2));
    for (let x = r.x; x < r.x + r.w; x++)
      buf.set(x, y, dithered(x, y, b) ? C.periwinkle : dithered(x, y, a) ? C.indigo : C.night);
  }
  const rnd = seeded(3);
  for (let i = 0; i < 40; i++) {
    const x = r.x + rnd() * r.w;
    const y = r.y + rnd() * r.h * 0.6;
    const on = still || (Math.floor(t / 300) + i) % 5 !== 0;
    if (on) buf.set(x, y, i % 4 === 0 ? C.lavender : C.moonlight);
  }
  const moon = { x: r.x + r.w / 2, y: r.y + 30 };
  const shade = Math.max(0, 1 - Math.min(1, k / 0.7));
  const shadow = { x: moon.x - shade * 34, y: moon.y - shade * 6 };
  const full = k >= 0.7;
  for (let y = moon.y - 20; y <= moon.y + 20; y++)
    for (let x = moon.x - 20; x <= moon.x + 20; x++) {
      const d = Math.hypot(x - moon.x, y - moon.y);
      if (d > 14) continue;
      const inShadow = Math.hypot(x - shadow.x, y - shadow.y) <= 14;
      buf.set(
        x,
        y,
        inShadow
          ? d > 13
            ? C.indigo
            : C.ink
          : d > 12.5
            ? C.silver
            : (x + y) % 7 === 0
              ? C.silver
              : C.moonlight,
      );
    }
  if (full) {
    // The corona flares as the eclipse completes.
    const flare = still ? 0.6 : Math.min(1, (k - 0.7) / 0.2);
    for (let i = 0; i < 3; i++)
      for (const [x, y] of ringPixels(moon.x, moon.y, 15 + i + Math.round(flare * 2 * i)))
        if (dithered(x, y, flare * (1 - i * 0.3))) buf.set(x, y, i === 0 ? C.glow : C.lavender);
  }
  const ground = hills(buf, r, C.indigo, C.night, C.periwinkle);
  const bear = art.vignette;
  if (bear) drawSprite(buf, bear, Math.round(moon.x - bear.w / 2), ground + 6 - bear.h);
  else sleepingLump(buf, moon.x, ground + 4);
  if (!still && Math.floor(t / 500) % 2 === 0)
    sparkle(buf, moon.x + 26, ground - 18, 1, C.lavender);
}

/** A sleeping beast drawn in code (Umbra), used if the vignette art is missing. */
function sleepingLump(buf: PixelBuffer, cx: number, base: number): void {
  for (let y = base - 22; y <= base; y++)
    for (let x = cx - 30; x <= cx + 30; x++) {
      const e = ((x - cx) / 30) ** 2 + ((y - base) / 22) ** 2;
      if (e > 1) continue;
      buf.set(x, y, e > 0.86 ? C.ink : y < base - 16 ? C.periwinkle : C.indigo);
    }
}

/** Mossgrove: roots light up under the Hollow Stump and a great bloom opens above it. */
function bloom(
  buf: PixelBuffer,
  r: Rect,
  k: number,
  t: number,
  still: boolean,
  art: RealmArt,
): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    const band = (y - r.y) / r.h;
    for (let x = r.x; x < r.x + r.w; x++)
      buf.set(
        x,
        y,
        band < 0.5 ? C.mossDeep : dithered(x, y, (band - 0.5) * 3) ? C.moss : C.mossDeep,
      );
  }
  const ground = hills(buf, r, C.leaf, C.mossDeep, C.sprout);
  const cx = r.x + r.w / 2;
  // Glowing roots run out along the ground from the stump.
  const reach = stepped(Math.min(1, k / 0.6), 12) * (r.w / 2);
  for (let i = 0; i < reach; i++)
    for (const s of [-1, 1]) {
      const x = cx + s * i;
      const y = ground + 4 + Math.round(2 * Math.sin(i / 4) + (i % 9 === 0 ? 1 : 0));
      buf.set(x, y, i > reach - 3 ? C.glow : C.lichen);
    }
  const stump = art.vignette;
  const top = stump ? ground + 6 - stump.h : ground - 26;
  if (stump) drawSprite(buf, stump, Math.round(cx - stump.w / 2), top);
  else
    for (let y = top; y < ground + 6; y++)
      for (let x = cx - 14; x <= cx + 14; x++)
        buf.set(
          x,
          y,
          Math.abs(x - cx) > 13 || y === top
            ? C.ink
            : Math.abs(x - cx) < 5 && y > ground - 10
              ? C.barkDeep
              : C.bark,
        );
  // The bloom: petal rings open above the stump.
  const open = stepped(Math.max(0, Math.min(1, (k - 0.4) / 0.45)), 6);
  const fy = Math.max(r.y + 22, top - 12);
  if (open > 0) {
    const pr = 3 + open * 13;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2 + (still ? 0 : t / 3000);
      const px = cx + Math.cos(a) * pr * 0.7;
      const py = fy + Math.sin(a) * pr * 0.7;
      for (let y = -4; y <= 4; y++)
        for (let x = -4; x <= 4; x++) {
          const d = Math.hypot(x, y);
          if (d <= 4 * open + 0.5)
            buf.set(px + x, py + y, d > 3 * open ? C.berry : d > 1.5 ? C.rose : C.blush);
        }
    }
    for (let y = -3; y <= 3; y++)
      for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) <= 3) buf.set(cx + x, fy + y, C.sunflower);
  }
  // Fireflies drift up.
  const rnd = seeded(9);
  for (let i = 0; i < 18; i++) {
    const x0 = r.x + rnd() * r.w;
    const speed = 6 + rnd() * 10;
    const y = ground - ((rnd() * 60 + (still ? 0 : (t / 1000) * speed)) % (ground - r.y));
    buf.set(x0 + Math.sin(t / 600 + i) * 2, y, i % 3 ? C.lichen : C.sunflower);
  }
}

/** One frame of the Mythic mini-cutscene of `realm` (Mossgrove or Starhollow; others use Starhollow's sky). */
export function cutscene(
  buf: PixelBuffer,
  realm: Realm,
  k: number,
  t: number,
  still: boolean,
  art: RealmArt,
): void {
  dim(buf, 1, C.ink);
  const r = cutsceneWindow(buf);
  if (realm === 'mossgrove') bloom(buf, r, k, t, still, art);
  else eclipse(buf, r, k, t, still, art);
  frameWindow(buf, r, realm === 'mossgrove' ? C.straw : C.silver);
}
