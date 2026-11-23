import type { PlayerResult, SimParams } from './sim.js';

type Milestone = 'nonMythicLuck' | 'allLuck' | 'nonMythicCraft' | 'allCraft';

/** p-th percentile of days (null = not reached, sorts last). */
function percentile(days: (number | null)[], p: number): string {
  const sorted = days.map((d) => d ?? Infinity).sort((a, b) => a - b);
  const v = sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? Infinity;
  return Number.isFinite(v) ? String(v) : '>max';
}

function share(days: (number | null)[], within: number): string {
  const n = days.filter((d) => d !== null && d <= within).length;
  return `${((100 * n) / days.length).toFixed(0)} %`;
}

export function formatReport(params: SimParams, results: PlayerResult[]): string {
  const packsPerDay = results.reduce((s, r) => s + r.packs, 0) / results.length / params.days;
  const dust21 = results.map((r) => r.dustAtDay21).sort((a, b) => a - b);
  const rows: [string, Milestone][] = [
    ['12 non-Mythic, luck only', 'nonMythicLuck'],
    ['12 non-Mythic, + crafting', 'nonMythicCraft'],
    ['all 13, luck only', 'allLuck'],
    ['all 13, + crafting', 'allCraft'],
  ];
  const lines = [
    `econ-sim v0 · ${params.players} free players · ${params.days} days · seed "${params.seed}"`,
    `sources: ${params.freePacksPerDay} free packs/day + ${params.calendarGoldPerDay} calendar gold/day ` +
      `(pack ${params.packPriceGold} gold) · focus: ${params.realm} packs · ` +
      `realms: ${params.enabledRealms.join(', ')}`,
    `packs/day: ${packsPerDay.toFixed(2)}`,
    '',
    'days to complete a realm | median | p90 | ≤ 7 d | ≤ 21 d',
    ...rows.map(([label, key]) => {
      const days = results.map((r) => r[key]);
      return `${label.padEnd(25)}| ${percentile(days, 0.5).padStart(6)} | ${percentile(days, 0.9).padStart(4)} | ${share(days, 7).padStart(5)} | ${share(days, 21).padStart(6)}`;
    }),
    '',
    `unspent dust at day 21 (median): ${dust21[Math.floor(dust21.length / 2)] ?? 0}`,
  ];
  return lines.join('\n');
}
