import { CARD_FACE, MASTER_PALETTE } from '@pixel-packs/shared';
import { CARD_SKY_ROWS } from '../components/cardFace.js';

/** `#rrggbb` → GLSL `vec3(r, g, b)` in 0–1. */
export function glslVec3(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(4));
  return `vec3(${c.join(', ')})`;
}

const PALETTE = Object.values(MASTER_PALETTE);

/** The master palette as a flat `vec3` array for `uPalette`. */
export const PALETTE_UNIFORM = new Float32Array(
  PALETTE.flatMap((hex) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  }),
);
export const PALETTE_SIZE = PALETTE.length;
const P = MASTER_PALETTE;

/** Parchment name banner + rules box, from x 6 and y 80 to x 90 and y 114 (just above the badges). */
export const TEXT_AREA = { x: 6, y: 80, w: 84, h: 34 } as const;
const A = CARD_FACE.art;

/**
 * Constants shared by the card shader: geometry and named palette colours. The
 * full master palette is the `uPalette` uniform (`PALETTE_UNIFORM`): GLSL ES 1.0
 * (WebGL1) has no constant arrays, and the shader must run on both versions.
 */
export const GLSL_CONSTANTS = `
const vec2 SIZE = vec2(${String(CARD_FACE.size.w)}.0, ${String(CARD_FACE.size.h)}.0);
const vec4 WIN = vec4(${String(A.x)}.0, ${String(A.y)}.0, ${String(A.w)}.0, ${String(A.h)}.0);
// Name banner and rules box (with their parchment edges): effects keep text legible here.
const vec4 TEXT_AREA = vec4(${String(TEXT_AREA.x)}.0, ${String(TEXT_AREA.y)}.0, ${String(TEXT_AREA.w)}.0, ${String(TEXT_AREA.h)}.0);
const float SKY_ROWS = ${String(CARD_SKY_ROWS)}.0;
const int PALETTE_N = ${String(PALETTE.length)};
uniform vec3 uPalette[${String(PALETTE.length)}];
const vec3 INK = ${glslVec3(P.ink)};
const vec3 GLOW = ${glslVec3(P.glow)};
const vec3 MOONLIGHT = ${glslVec3(P.moonlight)};
const vec3 NIGHT = ${glslVec3(P.night)};
const vec3 INDIGO = ${glslVec3(P.indigo)};
const vec3 PERIWINKLE = ${glslVec3(P.periwinkle)};
const vec3 LILAC = ${glslVec3(P.lilac)};
const vec3 LAVENDER = ${glslVec3(P.lavender)};
`;
