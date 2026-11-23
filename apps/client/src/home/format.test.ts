import { describe, expect, it } from 'vitest';
import { CALENDAR_REWARDS } from '@pixel-packs/shared';
import { calendarTiles, countdownText, timerFill } from './format.js';

const cal = (day: number, claimedToday: boolean) => ({
  day,
  claimedToday,
  nextResetAt: '2026-11-24T00:00:00.000Z',
  rewards: [...CALENDAR_REWARDS],
});

describe('home format', () => {
  it('counts down in hours and minutes', () => {
    expect(countdownText(0)).toBe('now');
    expect(countdownText(30_000)).toBe('under a minute');
    expect(countdownText(12 * 60_000)).toBe('12 min');
    expect(countdownText((3 * 60 + 5) * 60_000)).toBe('3 h 05 min');
    expect(countdownText(8 * 3_600_000)).toBe('8 h 00 min');
  });

  it('fills the timer bar as the wait runs down', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    expect(timerFill(null, 8 * 3_600_000, now)).toBe(1);
    expect(timerFill('2026-11-23T16:00:00Z', 8 * 3_600_000, now)).toBe(0.5);
    expect(timerFill('2026-11-23T11:00:00Z', 8 * 3_600_000, now)).toBe(1);
  });

  it('marks calendar days', () => {
    expect(calendarTiles(cal(1, false)).map((t) => t.status)).toEqual([
      'today',
      'later',
      'later',
      'later',
      'later',
      'later',
      'later',
    ]);
    // Claimed today: `day` is the day just paid.
    expect(calendarTiles(cal(3, true)).map((t) => t.status)).toEqual([
      'claimed',
      'claimed',
      'claimed',
      'next',
      'later',
      'later',
      'later',
    ]);
    expect(calendarTiles(cal(7, true)).every((t) => t.status === 'claimed')).toBe(true);
    expect(calendarTiles(cal(7, false))[6]).toMatchObject({ day: 7, gold: 130, status: 'today' });
  });
});
