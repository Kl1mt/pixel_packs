import { PNG } from 'pngjs';

export interface ImageStats {
  width: number;
  height: number;
  /** Pixels with alpha > 0. */
  opaque: number;
  colours: number;
  /** Bounding box of opaque pixels, or null for an empty image. */
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
  touchesEdge: boolean;
}

export function decodePng(buf: Buffer): PNG {
  return PNG.sync.read(buf);
}

export function encodePng(png: PNG): Buffer {
  return PNG.sync.write(png);
}

export function imageStats(png: PNG): ImageStats {
  const { width, height, data } = png;
  const colours = new Set<number>();
  let opaque = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ((data[i + 3] ?? 0) === 0) continue;
      opaque++;
      colours.add(data.readUInt32BE(i));
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const bbox = x1 < 0 ? null : { x0, y0, x1, y1 };
  const touchesEdge = !!bbox && (x0 === 0 || y0 === 0 || x1 === width - 1 || y1 === height - 1);
  return { width, height, opaque, colours: colours.size, bbox, touchesEdge };
}

// 3×5 pixel digits for contact-sheet labels.
const DIGITS = [
  '111101101101111',
  '010110010010111',
  '111001111100111',
  '111001111001111',
  '101101111001001',
  '111100111001111',
  '111100111101111',
  '111001001001001',
  '111101111101111',
  '111101111001111',
];

function fill(png: PNG, x: number, y: number, w: number, h: number, rgba: number[]): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= png.width || yy >= png.height) continue;
      const i = (yy * png.width + xx) * 4;
      for (let k = 0; k < 4; k++) png.data[i + k] = rgba[k] ?? 255;
    }
  }
}

function drawNumber(png: PNG, n: number, x: number, y: number, px: number): void {
  let cx = x;
  for (const ch of String(n)) {
    const glyph = DIGITS[Number(ch)] ?? '';
    for (let i = 0; i < 15; i++) {
      if (glyph[i] === '1')
        fill(png, cx + (i % 3) * px, y + Math.floor(i / 3) * px, px, px, [30, 26, 38, 255]);
    }
    cx += 4 * px;
  }
}

/**
 * Numbered contact sheet: candidates upscaled by an integer `scale` on a light checker
 * (so transparency shows), with the candidate number above each tile.
 */
export function contactSheet(images: PNG[], columns: number, scale: number): PNG {
  const first = images[0];
  if (!first) throw new Error('no images');
  const tile = first.width * scale;
  const label = 7 * 2;
  const gap = 8;
  const rows = Math.ceil(images.length / columns);
  const sheet = new PNG({
    width: columns * (tile + gap) + gap,
    height: rows * (tile + label + gap) + gap,
  });
  fill(sheet, 0, 0, sheet.width, sheet.height, [232, 224, 213, 255]);
  images.forEach((img, n) => {
    const ox = gap + (n % columns) * (tile + gap);
    const oy = gap + Math.floor(n / columns) * (tile + label + gap);
    drawNumber(sheet, n + 1, ox, oy, 2);
    const ty = oy + label;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const checker = ((x >> 2) + (y >> 2)) % 2 === 0 ? 250 : 236;
        const i = (y * img.width + x) * 4;
        const a = (img.data[i + 3] ?? 0) / 255;
        const rgba = [0, 1, 2].map((k) =>
          Math.round((img.data[i + k] ?? 0) * a + checker * (1 - a)),
        );
        fill(sheet, ox + x * scale, ty + y * scale, scale, scale, [...rgba, 255]);
      }
    }
  });
  return sheet;
}
