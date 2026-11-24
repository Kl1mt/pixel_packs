import { MASTER_PALETTE as P, type PackTypeId } from '@pixel-packs/shared';
import { motes, type PetalLook } from './petals.js';

/** One pixel of a pack wrapping (pack-local art px), `t` ∈ [0, 1] along its vine. */
export interface WrapPixel {
  x: number;
  y: number;
  colour: string;
  /** Position along the vine; a pixel goes when the unwrap front passes it. */
  t: number;
  /** Which vine (each one unwraps in its own window of the tear). */
  vine: number;
}

/**
 * How a pack opens (GDD §3, §7). The framework draws the pack, the tear, the light and
 * the particles; a theme adds its wrapping and colours. Mossgrove (T12): vines and
 * petals. Starhollow (T13): the moon clasp turns and stardust swirls.
 */
export interface PackTheme {
  id: string;
  /** The tear seam across the satchel's mouth, in pack-local art px. */
  seam: { y: number; x0: number; x1: number };
  wrap: (inside: (x: number, y: number) => boolean) => WrapPixel[];
  /** Unwrap window of each vine within the tear progress (start, end). */
  vineWindows: readonly (readonly [number, number])[];
  /** What falls: petal sprites or motes (T22); none means nothing falls. */
  petals: readonly PetalLook[];
  /** Ambient petals per second while the scene is open. */
  ambient: number;
  /** Petals thrown out when the pack bursts open. */
  burst: number;
  /** The mound the pack sits on (top highlight, body), or none. */
  ground: readonly [string, string] | null;
  /** The moon clasp on the satchel turns as the seam tears (Starhollow). */
  clasp: boolean;
  /** Stardust motes swirling round the pack (0 = none). */
  stardust: number;
}

/** Plain stitched-seam opening (the Mythic pack until T21). */
export const PLAIN_THEME: PackTheme = {
  id: 'plain',
  seam: { y: 17, x0: 13, x1: 52 },
  wrap: () => [],
  vineWindows: [],
  petals: [],
  ambient: 0,
  burst: 0,
  ground: null,
  clasp: false,
  stardust: 0,
};

/** Starhollow: the moon clasp turns as the seam tears, stardust swirls and flies up. */
export const STARHOLLOW_THEME: PackTheme = {
  ...PLAIN_THEME,
  id: 'starhollow',
  petals: motes([P.lavender, P.moonlight, P.silver]),
  burst: 18,
  ground: [P.lilac, P.indigo],
  clasp: true,
  stardust: 44,
};

/** Pixels of one vine from `x0` to `x1`: y = y0 + slope·dx + a small wave, outlined in ink. */
function vine(
  id: number,
  x0: number,
  x1: number,
  y0: number,
  slope: number,
  inside: (x: number, y: number) => boolean,
): WrapPixel[] {
  const outline: WrapPixel[] = [];
  const fill: WrapPixel[] = [];
  const step = x1 > x0 ? 1 : -1;
  const len = Math.abs(x1 - x0);
  for (let i = 0; i <= len; i++) {
    const x = x0 + i * step;
    const y = Math.round(y0 + slope * i + 1.2 * Math.sin(i / 3));
    // Hug the satchel: the vine may only stick out one pixel past its outline.
    if (!inside(x, y) && !inside(x - step, y)) continue;
    const t = i / len;
    const at = (dx: number, dy: number, colour: string) => ({
      x: x + dx * step,
      y: y + dy,
      colour,
      t,
      vine: id,
    });
    outline.push(at(0, -1, P.ink), at(0, 2, P.ink));
    fill.push(at(0, 0, P.sprout), at(0, 1, P.leaf));
    if (i % 6 === 2) {
      // A leaf above, the next one below.
      const up = i % 12 === 2;
      const d = up ? -1 : 1;
      const base = up ? -1 : 2;
      outline.push(at(0, base + 2 * d, P.ink), at(2, base + d, P.ink), at(1, base + 2 * d, P.ink));
      fill.push(
        at(0, base, P.lichen),
        at(1, base, P.sprout),
        at(1, base + d, P.lichen),
        at(0, base + d, P.sprout),
      );
    }
  }
  return [...outline, ...fill];
}

/** Mossgrove: two leafy vines bind the satchel and unwind as it tears; petals drift down. */
export const MOSSGROVE_THEME: PackTheme = {
  id: 'mossgrove',
  seam: { y: 19, x0: 15, x1: 47 },
  wrap: (inside) => [...vine(0, 7, 57, 25, 0.06, inside), ...vine(1, 57, 7, 50, -0.04, inside)],
  vineWindows: [
    [0, 0.7],
    [0.3, 1],
  ],
  // Petal sprites in blossom pinks and cream, and a few small leaves (T22).
  petals: [
    { colour: P.blush, shade: P.rose, shape: 'blossom' },
    { colour: P.blush, shade: P.rose, shape: 'round' },
    { colour: P.rose, shade: P.berry, shape: 'slim' },
    { colour: P.glow, shade: P.blush, shape: 'blossom' },
    { colour: P.glow, shade: P.blush, shape: 'round' },
    { colour: P.sprout, shade: P.leaf, shape: 'leaf' },
    { colour: P.lichen, shade: P.moss, shape: 'leaf' },
  ],
  ambient: 6,
  burst: 28,
  ground: [P.leaf, P.moss],
  clasp: false,
  stardust: 0,
};

export function themeFor(packTypeId: PackTypeId): PackTheme {
  if (packTypeId === 'realm:mossgrove') return MOSSGROVE_THEME;
  if (packTypeId === 'realm:starhollow') return STARHOLLOW_THEME;
  return PLAIN_THEME;
}

/** The pack sprite of a pack type (the Mythic pack has no art yet, see TASKS). */
export function packArt(packTypeId: PackTypeId): string {
  return packTypeId === 'mythic'
    ? '/assets/packs/starhollow.png'
    : `/assets/packs/${packTypeId.slice(6)}.png`;
}

/** Unwrap front of vine `i` for a tear progress `p` (0 = wrapped, 1 = gone). */
export function vineFront(theme: PackTheme, i: number, p: number): number {
  const [a, b] = theme.vineWindows[i] ?? [0, 1];
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}
