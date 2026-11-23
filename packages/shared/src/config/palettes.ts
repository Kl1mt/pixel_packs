import type { Realm } from '../model/enums.js';

/**
 * Master palette (GDD §19): 32 colours shared by every asset. Realm sub-palettes
 * are subsets of it and are passed to PixelLab as `target_palette`.
 */
export const MASTER_PALETTE = {
  ink: '#1e1a26',
  dusk: '#5e5463',
  stone: '#8c8191',
  mist: '#bdb3b8',
  cream: '#e8e0d5',
  glow: '#fff8ec',
  barkDeep: '#3d2a22',
  bark: '#5c3d2e',
  wood: '#8a5a3c',
  oak: '#b5804f',
  straw: '#d9ad74',
  mossDeep: '#26402c',
  moss: '#3e6b3a',
  leaf: '#6a9a45',
  sprout: '#a3c25e',
  lichen: '#d4e39a',
  berryDeep: '#6e2236',
  berry: '#a8344a',
  rose: '#d95f5f',
  blush: '#f2a0a0',
  amber: '#e8a33d',
  sunflower: '#f6d36b',
  tealDeep: '#2c5e6b',
  teal: '#4f9a9a',
  seafoam: '#8fd0c2',
  night: '#1f2148',
  indigo: '#343a7a',
  periwinkle: '#5a5fae',
  lilac: '#8f87d1',
  lavender: '#c3b5ec',
  silver: '#a9b8d6',
  moonlight: '#dfe6f5',
} as const;

export type PaletteColourName = keyof typeof MASTER_PALETTE;

export interface RealmPalette {
  /** Name sent to PixelLab (it "helps the look"). */
  readonly name: string;
  readonly colours: readonly PaletteColourName[];
}

/** 8–16 colour sub-palettes per realm (GDD §19). Only the M1 realms exist so far. */
export const REALM_PALETTES: Partial<Record<Realm, RealmPalette>> = {
  mossgrove: {
    name: 'Mossgrove: moss, bark, berry',
    colours: [
      'ink',
      'stone',
      'cream',
      'barkDeep',
      'bark',
      'wood',
      'oak',
      'straw',
      'mossDeep',
      'moss',
      'leaf',
      'sprout',
      'lichen',
      'berry',
      'rose',
      'lilac',
    ],
  },
  starhollow: {
    name: 'Starhollow: indigo, silver, lilac',
    colours: [
      'ink',
      'dusk',
      'stone',
      'mist',
      'glow',
      'wood',
      'rose',
      'amber',
      'sunflower',
      'night',
      'indigo',
      'periwinkle',
      'lilac',
      'lavender',
      'silver',
      'moonlight',
    ],
  },
};

export function masterPaletteHex(): string[] {
  return Object.values(MASTER_PALETTE);
}

/** Hex colours of a realm's sub-palette; throws for realms without one yet. */
export function realmPaletteHex(realm: Realm): string[] {
  const palette = REALM_PALETTES[realm];
  if (!palette) throw new Error(`No palette defined for realm ${realm}`);
  return palette.colours.map((name) => MASTER_PALETTE[name]);
}
