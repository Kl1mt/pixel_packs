import type { PNG } from 'pngjs';
import {
  CARD_FACE,
  MASTER_PALETTE,
  RARITIES,
  frameMaterialHex,
  type PaletteColourName,
  type Rarity,
} from '@pixel-packs/shared';
import { CLEAR, blank, get, hexToRgba, rgbaToHex, set, type Rgba } from './pixels.js';

/**
 * Hand-tunes the generated base frame (t06/frame-base #1, 96×128) into the six
 * rarity frames (GDD §4): the art window is stretched to exactly 64×64 and cut
 * out, the text box is shortened to fit, six pip sockets replace the four
 * generated ones, and the wood ramp is swapped for each rarity's material.
 */

const { art } = CARD_FACE;

/**
 * Destination row → source row. The generated window is 49 rows tall
 * (src 15–63); 15 plain side rows (src 22–36) are repeated to reach 64, and
 * the same 15 rows are dropped from the uniform middle of the text box
 * (src 93–107), so everything below keeps its place.
 */
export function sourceRow(y: number): number {
  if (y <= 36) return y;
  if (y <= 51) return 22 + (y - 37);
  if (y <= 78) return 37 + (y - 52);
  if (y <= 107) return 64 + (y - 79);
  return y;
}

/** The base frame's wood colours, darkest first, mapped onto a 5-step material ramp. */
const WOOD_TO_RAMP: Partial<Record<PaletteColourName, number>> = {
  barkDeep: 0,
  bark: 1,
  wood: 2,
  oak: 3,
  straw: 4,
  amber: 4,
  sunflower: 4,
};

const BY_HEX = new Map<string, PaletteColourName>(
  Object.entries(MASTER_PALETTE).map(([name, hex]) => [hex, name as PaletteColourName]),
);

const INK = hexToRgba(MASTER_PALETTE.ink);
const WINDOW_FILL = new Set<string>([MASTER_PALETTE.glow, MASTER_PALETTE.cream]);

/**
 * The generated crest ring touches the canvas top (its outline is cut off), and the
 * bottom 2 rows are empty, so the whole frame moves down 2 px and the ring gets a cap.
 */
export const TOP_PAD = 2;

/** Restructures the base (geometry only, still wood). */
export function reshapeBase(base: PNG): PNG {
  const out = blank(CARD_FACE.size.w, CARD_FACE.size.h);
  for (let y = TOP_PAD; y < out.height; y++) {
    const sy = sourceRow(y - TOP_PAD);
    for (let x = 0; x < out.width; x++) set(out, x, y, get(base, x, sy));
  }
  // Crest cap: close the ring with an ink row above its old top row.
  for (let x = 36; x <= 60; x++) {
    const c = get(out, x, TOP_PAD);
    if (c[3] > 0 && rgbaToHex(c) !== MASTER_PALETTE.ink) set(out, x, TOP_PAD - 1, INK);
  }
  const woodMid = hexToRgba(MASTER_PALETTE.wood);
  // Art window: exact 64×64 hole with a 1 px ink rim; leftover window fill becomes wood.
  for (let y = art.y - 1; y <= art.y + art.h; y++) {
    for (let x = art.x - 3; x <= art.x + art.w + 2; x++) {
      const inside = x >= art.x && x < art.x + art.w && y >= art.y && y < art.y + art.h;
      const rim = x >= art.x - 1 && x <= art.x + art.w && (y === art.y - 1 || y === art.y + art.h);
      const side = (x === art.x - 1 || x === art.x + art.w) && y >= art.y - 1 && y <= art.y + art.h;
      if (inside) set(out, x, y, CLEAR);
      else if (rim || side) set(out, x, y, INK);
      else if (WINDOW_FILL.has(rgbaToHex(get(out, x, y)))) set(out, x, y, woodMid);
    }
  }
  // Pip strip: wipe the four generated sockets with the plain wood row above them.
  const pipTop = 116 + TOP_PAD;
  for (let y = pipTop; y <= pipTop + 6; y++)
    for (let x = 20; x <= 74; x++) set(out, x, y, get(out, x, pipTop - 1));
  return out;
}

const SOCKET = ['.###.', '#ooo#', '#ooo#', '#ooo#', '.###.'];

function drawPips(png: PNG, filled: number, pip: Rgba, empty: Rgba): void {
  const highlight = hexToRgba(MASTER_PALETTE.glow);
  CARD_FACE.pips.forEach((r, i) => {
    SOCKET.forEach((row, dy) => {
      Array.from(row).forEach((ch, dx) => {
        if (ch === '.') return;
        const lit = i < filled;
        let c = ch === '#' ? INK : lit ? pip : empty;
        if (lit && dx === 1 && dy === 1) c = highlight;
        set(png, r.x + dx, r.y + dy, c);
      });
    });
  });
}

/** One rarity frame from the reshaped base. */
export function rarityFrame(reshaped: PNG, rarity: Rarity): PNG {
  const { ramp, pip } = frameMaterialHex(rarity);
  const rampRgba = ramp.map(hexToRgba);
  const out = blank(reshaped.width, reshaped.height);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const c = get(reshaped, x, y);
      const name = BY_HEX.get(rgbaToHex(c));
      const step = name === undefined ? undefined : WOOD_TO_RAMP[name];
      set(out, x, y, c[3] > 0 && step !== undefined ? (rampRgba[step] ?? c) : c);
    }
  }
  drawPips(out, RARITIES.indexOf(rarity) + 1, hexToRgba(pip), rampRgba[0] ?? INK);
  return out;
}

export function allFrames(base: PNG): Record<Rarity, PNG> {
  const reshaped = reshapeBase(base);
  return Object.fromEntries(RARITIES.map((r) => [r, rarityFrame(reshaped, r)])) as Record<
    Rarity,
    PNG
  >;
}
