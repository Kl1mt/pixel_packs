import { PNG } from 'pngjs';
import { encodeApng } from './apng.js';

/** Review backdrop (the contact sheets' parchment) and the baseline guide colour. */
const BG: [number, number, number] = [232, 224, 213];
const GUIDE: [number, number, number] = [214, 92, 92];

/** Bottom opaque row of an image, or -1 if it is empty. */
export function bottomRow(png: PNG): number {
  for (let y = png.height - 1; y >= 0; y--) {
    for (let x = 0; x < png.width; x++)
      if ((png.data[(y * png.width + x) * 4 + 3] ?? 0) > 0) return y;
  }
  return -1;
}

export function blank(width: number, height: number): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) png.data.set([...BG, 255], i * 4);
  return png;
}

/** Draws `src` at integer `scale` onto `dst` at (ox, oy), alpha-blended over the backdrop. */
export function blit(dst: PNG, src: PNG, ox: number, oy: number, scale: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const a = (src.data[i + 3] ?? 0) / 255;
      if (a === 0) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ox + x * scale + dx;
          const py = oy + y * scale + dy;
          if (px < 0 || py < 0 || px >= dst.width || py >= dst.height) continue;
          const j = (py * dst.width + px) * 4;
          for (let k = 0; k < 3; k++) {
            const s = src.data[i + k] ?? 0;
            const d = dst.data[j + k] ?? 0;
            dst.data[j + k] = Math.round(s * a + d * (1 - a));
          }
        }
      }
    }
  }
}

/** A horizontal 1-screen-px guide line at art row `row` (drawn under the sprite's bottom). */
export function guide(dst: PNG, ox: number, oy: number, width: number, row: number, scale: number) {
  if (row < 0) return;
  const py = oy + (row + 1) * scale;
  if (py >= dst.height) return;
  for (let x = 0; x < width; x++) dst.data.set([...GUIDE, 255], (py * dst.width + ox + x) * 4);
}

/** A looping APNG of the frames at 4×, with a guide under frame 1's feet. */
export function animationPreview(frames: PNG[], delayMs: number, scale = 4): Buffer {
  const first = frames[0];
  if (!first) throw new Error('no frames');
  const pad = 8;
  const w = first.width * scale + pad * 2;
  const h = first.height * scale + pad * 2;
  const base = bottomRow(first);
  return encodeApng(
    frames.map((f) => {
      const img = blank(w, h);
      guide(img, pad, pad, f.width * scale, base, scale);
      blit(img, f, pad, pad, scale);
      return { image: img, delayMs };
    }),
  );
}

export interface BoardCell {
  frames: PNG[];
}

/**
 * Side-by-side board: one row per character, one column per animation, all cells
 * ticking together (each cell loops its own frames). Cells are bottom-centred so
 * baselines line up across the row; the guide marks each cell's frame-1 baseline.
 */
export function boardPreview(rows: (BoardCell | null)[][], tickMs: number, scale = 3): Buffer {
  const all = rows.flat().filter((c): c is BoardCell => c !== null && c.frames.length > 0);
  const cw = Math.max(...all.map((c) => c.frames[0]?.width ?? 0)) * scale;
  const ch = Math.max(...all.map((c) => c.frames[0]?.height ?? 0)) * scale;
  const gap = 6;
  const cols = Math.max(...rows.map((r) => r.length));
  const width = cols * (cw + gap) + gap;
  const height = rows.length * (ch + gap) + gap;
  const lens = all.map((c) => c.frames.length);
  const lcm = lens.reduce((a, b) => (a * b) / gcd(a, b), 1);
  const ticks = Math.min(lcm, 48);
  const out = [];
  for (let t = 0; t < ticks; t++) {
    const img = blank(width, height);
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        const f = cell?.frames[t % cell.frames.length];
        const f0 = cell?.frames[0];
        if (!f || !f0) return;
        const ox = gap + c * (cw + gap) + Math.floor((cw - f.width * scale) / 2);
        const oy = gap + r * (ch + gap) + (ch - f.height * scale);
        guide(img, ox, oy, f.width * scale, bottomRow(f0), scale);
        blit(img, f, ox, oy, scale);
      });
    });
    out.push({ image: img, delayMs: tickMs });
  }
  return encodeApng(out);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
