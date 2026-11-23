import type { Rarity } from '../model/enums.js';
import { MASTER_PALETTE, type PaletteColourName } from './palettes.js';

/**
 * Card-face geometry (GDD §4) in art pixels on the 96×128 frame
 * (`apps/client/public/assets/frames/<rarity>.png`, composed in T06).
 * The renderer (T07/T11) places art, text, stats and pips with these rects.
 * The generated base sits 2 px lower than generated (`TOP_PAD`) so the crest
 * ring on the top edge is fully inside the canvas.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const CARD_FACE = {
  size: { w: 96, h: 128 },
  /** Transparent 64×64 art window; the art is bottom-aligned inside it. */
  art: { x: 16, y: 17, w: 64, h: 64 },
  /** Round crest socket on the top edge (realm crest). */
  crest: { x: 43, y: 4, w: 10, h: 10 },
  /** Name banner text box. */
  name: { x: 10, y: 83, w: 76, h: 9 },
  /** Rules text box. */
  rules: { x: 9, y: 96, w: 78, h: 13 },
  /** ATK (left) and HP (right) badge sockets: the cream interior of each circle. */
  atk: { x: 7, y: 114, w: 10, h: 11 },
  hp: { x: 79, y: 114, w: 10, h: 11 },
  /** Six 5×5 rarity pips along the bottom edge, left to right. */
  pips: [0, 1, 2, 3, 4, 5].map((i) => ({ x: 22 + i * 9, y: 119, w: 5, h: 5 })),
} as const;

/**
 * Frame material per rarity (wood → copper → silver → amethyst → gold → starmetal,
 * GDD §4): a 5-step ramp, darkest first, that replaces the wood ramp of the base
 * frame, and the colour of the filled pips. Rarity is never colour alone: the
 * pip count (1–6) and the label carry it too (§18).
 */
export interface FrameMaterial {
  readonly name: string;
  readonly ramp: readonly [
    PaletteColourName,
    PaletteColourName,
    PaletteColourName,
    PaletteColourName,
    PaletteColourName,
  ];
  readonly pip: PaletteColourName;
}

export const FRAME_MATERIALS: Record<Rarity, FrameMaterial> = {
  common: { name: 'wood', ramp: ['barkDeep', 'bark', 'wood', 'oak', 'straw'], pip: 'straw' },
  uncommon: { name: 'copper', ramp: ['berryDeep', 'berry', 'rose', 'blush', 'glow'], pip: 'blush' },
  rare: {
    name: 'silver',
    ramp: ['dusk', 'stone', 'silver', 'mist', 'moonlight'],
    pip: 'moonlight',
  },
  epic: {
    name: 'amethyst',
    ramp: ['night', 'indigo', 'periwinkle', 'lilac', 'lavender'],
    pip: 'lavender',
  },
  legendary: {
    name: 'gold',
    ramp: ['bark', 'wood', 'amber', 'sunflower', 'glow'],
    pip: 'sunflower',
  },
  mythic: {
    name: 'starmetal',
    ramp: ['night', 'tealDeep', 'teal', 'seafoam', 'moonlight'],
    pip: 'seafoam',
  },
};

export function frameMaterialHex(rarity: Rarity): { ramp: string[]; pip: string } {
  const m = FRAME_MATERIALS[rarity];
  return { ramp: m.ramp.map((c) => MASTER_PALETTE[c]), pip: MASTER_PALETTE[m.pip] };
}
