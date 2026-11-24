import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { LEFT_TIMELINE, RIGHT_TIMELINE, mirror, timelineAt, timelineLength } from './lane.js';

describe('battle lane', () => {
  it('runs both sides for the same number of ticks', () => {
    expect(timelineLength(LEFT_TIMELINE)).toBe(timelineLength(RIGHT_TIMELINE));
  });

  it('lands each hit while the other side is mid-attack', () => {
    const leftAttack = 20; // after idle 8 + walk 12
    expect(timelineAt(LEFT_TIMELINE, leftAttack).anim).toBe('attack');
    expect(timelineAt(RIGHT_TIMELINE, leftAttack + 3)).toEqual({ anim: 'hurt', frame: 0 });
    expect(timelineAt(RIGHT_TIMELINE, 30).anim).toBe('attack');
    expect(timelineAt(LEFT_TIMELINE, 33)).toEqual({ anim: 'hurt', frame: 0 });
  });

  it('mirrors horizontally', () => {
    const png = new PNG({ width: 3, height: 1 });
    png.data.set([255, 0, 0, 255], 0);
    const m = mirror(png);
    expect([...m.data.subarray(8, 12)]).toEqual([255, 0, 0, 255]);
    expect(m.data[3]).toBe(0);
  });
});
