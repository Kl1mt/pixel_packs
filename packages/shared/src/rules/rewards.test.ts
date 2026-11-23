import { describe, expect, it } from 'vitest';
import { CALENDAR_REWARDS, FREE_PACK_INTERVAL_MS as H8 } from '../config/economy.js';
import {
  calendarDayIndex,
  calendarReward,
  claimFreePack,
  freePackStatus,
  initialFreePackAnchor,
  nextUtcMidnight,
  utcDayKey,
} from './rewards.js';

const t0 = new Date('2026-11-23T10:00:00.000Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

describe('free-pack timer', () => {
  it('starts a new account with one pack ready and the next 8 h later', () => {
    const anchor = initialFreePackAnchor(t0);
    expect(freePackStatus(anchor, t0)).toEqual({ stored: 1, max: 2, nextAt: at(H8) });
  });

  it('stores at most two packs and loses time while full', () => {
    const anchor = t0;
    expect(freePackStatus(anchor, at(H8 - 1)).stored).toBe(0);
    expect(freePackStatus(anchor, at(H8)).stored).toBe(1);
    expect(freePackStatus(anchor, at(2 * H8))).toEqual({ stored: 2, max: 2, nextAt: null });
    expect(freePackStatus(anchor, at(10 * H8)).stored).toBe(2);
    // Claiming from a full store: one left, the next ready a full interval later.
    const after = claimFreePack(anchor, at(10 * H8));
    expect(after).not.toBeNull();
    if (after === null) return;
    expect(freePackStatus(after, at(10 * H8))).toEqual({ stored: 1, max: 2, nextAt: at(11 * H8) });
  });

  it('keeps partial progress when claiming below the cap', () => {
    const anchor = t0;
    const now = at(H8 + 1000);
    const after = claimFreePack(anchor, now);
    expect(after).toEqual(at(H8));
    if (after === null) return;
    expect(freePackStatus(after, now)).toEqual({ stored: 0, max: 2, nextAt: at(2 * H8) });
    expect(claimFreePack(after, now)).toBeNull();
  });

  it('never allows more claims than packs accrued', () => {
    let anchor = t0;
    let claims = 0;
    for (let h = 0; h <= 80; h++) {
      const now = at(h * 60 * 60 * 1000);
      const next = claimFreePack(anchor, now);
      if (next) {
        anchor = next;
        claims += 1;
      }
    }
    expect(claims).toBe(10); // 80 h / 8 h, claimed as soon as ready
  });
});

describe('calendar', () => {
  it('cycles through 7 days and pays 50 gold/day on average', () => {
    expect(CALENDAR_REWARDS).toHaveLength(7);
    expect(calendarDayIndex(0)).toBe(0);
    expect(calendarDayIndex(6)).toBe(6);
    expect(calendarDayIndex(7)).toBe(0);
    const gold = CALENDAR_REWARDS.reduce((s, r) => s + r.gold, 0);
    expect(gold / 7).toBe(50);
    expect(calendarReward(6).gold).toBeGreaterThan(0);
    expect(() => calendarReward(7)).toThrow(RangeError);
  });

  it('resets at 00:00 UTC', () => {
    expect(utcDayKey(new Date('2026-11-23T23:59:59.999Z'))).toBe('2026-11-23');
    expect(utcDayKey(new Date('2026-11-24T00:00:00.000Z'))).toBe('2026-11-24');
    expect(nextUtcMidnight(new Date('2026-11-23T05:00:00Z'))).toEqual(
      new Date('2026-11-24T00:00:00Z'),
    );
    expect(nextUtcMidnight(new Date('2026-11-24T00:00:00Z'))).toEqual(
      new Date('2026-11-25T00:00:00Z'),
    );
  });
});
