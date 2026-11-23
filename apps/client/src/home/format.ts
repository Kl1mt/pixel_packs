import type { EconomyState } from '@pixel-packs/shared';

type Calendar = EconomyState['calendar'];

/** "3 h 05 min", "12 min", "under a minute": a calm countdown, no seconds ticking. */
export function countdownText(ms: number): string {
  const mins = Math.ceil(Math.max(0, ms) / 60_000);
  if (ms <= 0) return 'now';
  if (mins <= 1) return 'under a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${String(m)} min`;
  return `${String(h)} h ${String(m).padStart(2, '0')} min`;
}

/** Share of the free-pack interval already waited (0–1), for the timer bar. */
export function timerFill(nextAt: string | null, intervalMs: number, now: number): number {
  if (nextAt === null) return 1;
  const left = new Date(nextAt).getTime() - now;
  return Math.min(1, Math.max(0, 1 - left / intervalMs));
}

export type CalendarTileStatus = 'claimed' | 'today' | 'next' | 'later';
export interface CalendarTile {
  day: number;
  gold: number;
  dust: number;
  status: CalendarTileStatus;
}

/**
 * The 7 calendar days (GDD §8) with their state. Before today's claim `day` is the day
 * the claim will pay; after it, `day` is the day just paid (the server's convention), so
 * the next one comes tomorrow. After the 7th claim the whole week is stamped.
 */
export function calendarTiles(cal: Calendar): CalendarTile[] {
  return cal.rewards.map((r, i) => {
    const day = i + 1;
    let status: CalendarTileStatus;
    if (cal.claimedToday)
      status = day <= cal.day ? 'claimed' : day === cal.day + 1 ? 'next' : 'later';
    else status = day < cal.day ? 'claimed' : day === cal.day ? 'today' : 'later';
    return { day, gold: r.gold, dust: r.dust, status };
  });
}
