import type { Realm } from '../model/enums.js';
import { CARD_FACE } from './cardFace.js';
import { MASTER_PALETTE, type PaletteColourName } from './palettes.js';

/**
 * Realm crests for the round crest socket on the card frame (GDD §4, T20).
 * Hand-tuned from the 32×32 T13 moment crests (`public/assets/moments/crest-*.png`):
 * their centre motif, redrawn pixel by pixel at socket size in palette colours.
 * The frame's ink ring stays the crest's rim.
 *
 * Grids are 11×11 with their top-left at `CREST_ORIGIN` (= `CARD_FACE.crest`); "." leaves the frame pixel.
 * Every other cell sits on the socket's cream interior (`CREST_SOCKET`, tested on all six frames).
 */
export const CREST_ORIGIN = { x: CARD_FACE.crest.x, y: CARD_FACE.crest.y } as const;

/** Socket interior per grid row: first and last column (inclusive), measured on the T06 frames. */
export const CREST_SOCKET: readonly (readonly [number, number])[] = [
  [3, 7],
  [2, 9],
  [1, 9],
  [0, 10],
  [0, 10],
  [0, 10],
  [0, 10],
  [1, 10],
  [1, 9],
  [3, 8],
  [4, 7],
];

interface CrestArt {
  readonly keys: Readonly<Record<string, PaletteColourName>>;
  readonly rows: readonly string[];
}

/** Every realm with cards (M1) has a crest; the others get theirs with their cards. */
export const REALM_CRESTS: Partial<Record<Realm, CrestArt>> = {
  // A veined leaf on a curling stem, on the socket's own cream (the T13 crest has a clear centre).
  mossgrove: {
    keys: { o: 'sprout', k: 'lichen', l: 'leaf', m: 'moss', d: 'mossDeep', w: 'bark' },
    rows: [
      '...........',
      '......l....',
      '.....olm...',
      '....olkmd..',
      '...oolkmmd.',
      '...ollkmmd.',
      '...olkmmd..',
      '....lkmd...',
      '.....wd....',
      '....w......',
      '...........',
    ],
  },
  // A crescent moon and a twinkle on a night sky, filling the socket like the T13 disc.
  starhollow: {
    keys: { n: 'night', g: 'glow', s: 'mist', i: 'indigo' },
    rows: [
      '...nnnnn...',
      '..nnnsgnnn.',
      '.nnnnnggnn.',
      'nnsnnnnggnn',
      'nsgsnnnggnn',
      'nnsnnnnggnn',
      'nnnnnnnggnn',
      '.nnnnnggsnn',
      '.nnsgggsnn.',
      '...nnnnnn..',
      '....nnnn...',
    ],
  },
};

/** Crest pixels for a realm on the 96×128 face (empty for realms without a crest yet). */
export function realmCrestPixels(realm: Realm): { x: number; y: number; colour: string }[] {
  const art = REALM_CRESTS[realm];
  if (!art) return [];
  const out: { x: number; y: number; colour: string }[] = [];
  art.rows.forEach((row, dy) => {
    Array.from(row).forEach((c, dx) => {
      if (c === '.') return;
      const name = art.keys[c];
      if (!name) throw new Error(`crest ${realm}: no colour for ${JSON.stringify(c)}`);
      out.push({ x: CREST_ORIGIN.x + dx, y: CREST_ORIGIN.y + dy, colour: MASTER_PALETTE[name] });
    });
  });
  return out;
}
