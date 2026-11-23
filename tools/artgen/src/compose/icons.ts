import type { PNG } from 'pngjs';
import { MASTER_PALETTE } from '@pixel-packs/shared';
import {
  blank,
  bbox,
  brightness,
  get,
  hexToRgba,
  opaque,
  rgbaToHex,
  set,
  type Rgba,
} from './pixels.js';

/**
 * Reduces a 32×32 pixflux icon to a 16×16 pixel icon (T06 decision: icons are
 * 16×16 art px). Each 2×2 block becomes its most common non-outline colour
 * (darker wins ties), then a fresh 1 px ink outline is drawn around the shape,
 * so the outline stays 1 px instead of turning into mush.
 */
export const ICON_SIZE = 16;

const INK = hexToRgba(MASTER_PALETTE.ink);

function blockColour(src: PNG, bx: number, by: number): Rgba | null {
  const counts = new Map<string, { c: Rgba; n: number }>();
  let solid = 0;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const c = get(src, bx + dx, by + dy);
      if (!opaque(c)) continue;
      solid++;
      const hex = rgbaToHex(c);
      if (hex === MASTER_PALETTE.ink) continue;
      const e = counts.get(hex) ?? { c, n: 0 };
      e.n++;
      counts.set(hex, e);
    }
  }
  if (solid < 2) return null;
  const best = [...counts.values()].sort((a, b) => b.n - a.n || brightness(a.c) - brightness(b.c));
  return best[0]?.c ?? INK;
}

export function reduceIcon(src: PNG): PNG {
  const b = bbox(src);
  const out = blank(ICON_SIZE, ICON_SIZE);
  if (!b) return out;
  // Centre the content on the 2× grid so it lands centred in 16×16 (minus the outline ring).
  const w = Math.ceil((b.x1 - b.x0 + 1) / 2);
  const h = Math.ceil((b.y1 - b.y0 + 1) / 2);
  const ox = Math.floor((ICON_SIZE - w) / 2);
  const oy = Math.floor((ICON_SIZE - h) / 2);
  const body = blank(ICON_SIZE, ICON_SIZE);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = blockColour(src, b.x0 + x * 2, b.y0 + y * 2);
      if (c) set(body, ox + x, oy + y, c);
    }
  }
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const c = get(body, x, y);
      if (opaque(c)) {
        set(out, x, y, c);
        continue;
      }
      const touches = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx = 0, dy = 0]) => opaque(get(body, x + dx, y + dy)));
      if (touches) set(out, x, y, INK);
    }
  }
  return out;
}
