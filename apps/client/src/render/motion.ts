import { CARD_FACE } from '@pixel-packs/shared';

/** Foil band position on the diagonal d = x + ⌊y/2⌋ (0 … 158 across the card). */
const D_MAX = CARD_FACE.size.w - 1 + Math.floor((CARD_FACE.size.h - 1) / 2);
const OFF = -24;
/** Auto sweep: 2.4 s across, then 2.1 s of rest. */
export const FOIL_SWEEP = { cross: 2.4, period: 4.5 } as const;
/** Where the band rests in the reduced version without a pointer: a still sheen. */
export const FOIL_REST = Math.round(D_MAX * 0.4);

/** Diagonal coordinate under a pointer in art px. */
export function foilDiagonal(p: { x: number; y: number }): number {
  return Math.floor(p.x) + Math.floor(Math.floor(p.y) / 2);
}

/**
 * Next foil light position. Under the pointer the band eases to the pointer's
 * diagonal (the "cursor tilt" of GDD §6); otherwise it sweeps on its own
 * (full) or rests still (reduced). Positions are whole art px.
 */
export function foilLight(
  current: number,
  time: number,
  pointer: { x: number; y: number } | null,
  reduced: boolean,
): number {
  let target: number;
  if (pointer) target = foilDiagonal(pointer);
  else if (reduced) target = FOIL_REST;
  else {
    const s = (time % FOIL_SWEEP.period) / FOIL_SWEEP.cross;
    return s < 1 ? Math.round(OFF + s * (D_MAX - 2 * OFF)) : OFF;
  }
  if (Math.abs(target - current) <= 1) return target;
  return Math.round(current + (target - current) * 0.3);
}
