import { PNG } from 'pngjs';
import { imageStats } from './png.js';

/**
 * Moves every pixel by whole pixels (no resampling); fully transparent pixels become
 * (0, 0, 0, 0). Pixels shifted off the canvas are an error.
 */
export function translate(png: PNG, dx: number, dy: number): PNG {
  const { width, height, data } = png;
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ((data[i + 3] ?? 0) === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        throw new Error(`shift (${String(dx)}, ${String(dy)}) moves pixels off the canvas`);
      }
      data.copy(out.data, (ny * width + nx) * 4, i, i + 4);
    }
  }
  return out;
}

/** Horizontal offset that centres the opaque bounding box (rounded towards the left). */
export function recentreOffsetX(png: PNG): number {
  const { bbox, width } = imageStats(png);
  if (!bbox) return 0;
  return Math.floor((width - (bbox.x1 - bbox.x0 + 1)) / 2) - bbox.x0;
}

/** True when `b` is `a` moved by whole pixels: same size and identical opaque pixels. */
export function sameUpToTranslation(a: PNG, b: PNG): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  const sa = imageStats(a).bbox;
  const sb = imageStats(b).bbox;
  if (!sa || !sb) return sa === sb;
  try {
    const moved = translate(a, sb.x0 - sa.x0, sb.y0 - sa.y0);
    // Normalise b too: transparent pixels may carry arbitrary RGB.
    return moved.data.equals(translate(b, 0, 0).data);
  } catch {
    return false;
  }
}
