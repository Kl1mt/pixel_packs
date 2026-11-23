import { PNG } from 'pngjs';

/** Small RGBA helpers for hand-tuning generated art in code (T06). */
export type Rgba = readonly [number, number, number, number];

export const CLEAR: Rgba = [0, 0, 0, 0];

export function hexToRgba(hex: string): Rgba {
  const v = Number.parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}

export function rgbaToHex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function blank(width: number, height: number): PNG {
  const png = new PNG({ width, height });
  png.data.fill(0);
  return png;
}

export function get(png: PNG, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return CLEAR;
  const i = (y * png.width + x) * 4;
  const d = png.data;
  return [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0, d[i + 3] ?? 0];
}

export function set(png: PNG, x: number, y: number, c: Rgba): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  png.data.set(c, (y * png.width + x) * 4);
}

export const opaque = (c: Rgba): boolean => c[3] >= 128;

/** Opaque bounding box, or null when the image is empty. */
export function bbox(png: PNG) {
  let x0 = png.width;
  let y0 = png.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (!opaque(get(png, x, y))) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function crop(png: PNG, x: number, y: number, w: number, h: number): PNG {
  const out = blank(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(out, i, j, get(png, x + i, y + j));
  return out;
}

export function cropToContent(png: PNG): PNG {
  const b = bbox(png);
  return b ? crop(png, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) : png;
}

/** Relative luminance-ish brightness (0–255), used to order colours. */
export const brightness = ([r, g, b]: Rgba): number => 0.3 * r + 0.59 * g + 0.11 * b;

/** Spans of non-empty columns (or rows) separated by fully transparent ones. */
function spans(n: number, empty: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const e = i === n || empty(i);
    if (!e && start < 0) start = i;
    if (e && start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  }
  return out;
}

const widest = (s: [number, number][]): [number, number] | undefined =>
  [...s].sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];

/** Crops to the widest run of columns, then of rows, dropping stray slivers from neighbouring pieces. */
export function cropToMainBody(png: PNG): PNG {
  const colEmpty = (x: number) => {
    for (let y = 0; y < png.height; y++) if (opaque(get(png, x, y))) return false;
    return true;
  };
  const cx = widest(spans(png.width, colEmpty));
  if (!cx) return png;
  const cols = crop(png, cx[0], 0, cx[1] - cx[0] + 1, png.height);
  const rowEmpty = (y: number) => {
    for (let x = 0; x < cols.width; x++) if (opaque(get(cols, x, y))) return false;
    return true;
  };
  const cy = widest(spans(cols.height, rowEmpty));
  return cy ? crop(cols, 0, cy[0], cols.width, cy[1] - cy[0] + 1) : cols;
}

/** WCAG 2 contrast ratio between two colours (1–21). */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const lum = ([r, g, bl]: Rgba) => {
    const ch = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}
