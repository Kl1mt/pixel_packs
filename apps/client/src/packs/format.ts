import type { PityMeter } from '@pixel-packs/shared';

/** "70 %", "0.1 %", "0.012 %": up to three decimals, no trailing zeros. */
export function percentText(n: number): string {
  return `${String(Math.round(n * 1000) / 1000)} %`;
}

/** Packs left until the Legendary-or-better guarantee, and how full the meter is (0–1). */
export function pityProgress(m: PityMeter): { left: number; fill: number } {
  const left = Math.max(1, m.legendaryHardPity - m.packsSinceLegendaryPlus);
  return { left, fill: Math.min(1, m.packsSinceLegendaryPlus / (m.legendaryHardPity - 1)) };
}

/** Local clock time of an ISO date, e.g. "14:05". */
export function clockText(iso: string, locale?: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
