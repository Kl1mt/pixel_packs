import {
  CALENDAR_REWARDS,
  FREE_PACK_INTERVAL_MS,
  FREE_PACK_MAX_STORED,
  FREE_PACK_STORED_AT_START,
  type CalendarReward,
} from '../config/economy.js';

/**
 * Free-pack timer (GDD §7). The state is one timestamp, the *anchor*: stored packs are
 * `floor((now − anchor) / interval)`, capped at the maximum. While capped, time is lost,
 * so the anchor is first pulled up to `now − max · interval`.
 */
export interface FreePackStatus {
  stored: number;
  max: number;
  /** When the next pack is ready, or null while the store is full. */
  nextAt: Date | null;
}

export function initialFreePackAnchor(now: Date): Date {
  return new Date(now.getTime() - FREE_PACK_STORED_AT_START * FREE_PACK_INTERVAL_MS);
}

function effectiveAnchor(anchor: Date, now: Date): number {
  return Math.max(anchor.getTime(), now.getTime() - FREE_PACK_MAX_STORED * FREE_PACK_INTERVAL_MS);
}

export function freePackStatus(anchor: Date, now: Date): FreePackStatus {
  const a = effectiveAnchor(anchor, now);
  const stored = Math.max(
    0,
    Math.min(FREE_PACK_MAX_STORED, Math.floor((now.getTime() - a) / FREE_PACK_INTERVAL_MS)),
  );
  const nextAt =
    stored >= FREE_PACK_MAX_STORED ? null : new Date(a + (stored + 1) * FREE_PACK_INTERVAL_MS);
  return { stored, max: FREE_PACK_MAX_STORED, nextAt };
}

/** The anchor after claiming one stored pack, or null if none is ready. */
export function claimFreePack(anchor: Date, now: Date): Date | null {
  if (freePackStatus(anchor, now).stored < 1) return null;
  return new Date(effectiveAnchor(anchor, now) + FREE_PACK_INTERVAL_MS);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC day of `now` as `YYYY-MM-DD` (daily reset at 00:00 UTC, GDD §8). */
export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnight(now: Date): Date {
  return new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS + DAY_MS);
}

/**
 * Calendar day (0–6) of the next claim, given how many calendar claims were made
 * before. Missed days pause the cycle; after day 7 it starts again at day 1.
 */
export function calendarDayIndex(claimsSoFar: number): number {
  return claimsSoFar % CALENDAR_REWARDS.length;
}

export function calendarReward(dayIndex: number): CalendarReward {
  const reward = CALENDAR_REWARDS[dayIndex];
  if (!reward) throw new RangeError(`no calendar day ${dayIndex}`);
  return reward;
}
