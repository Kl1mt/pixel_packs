import { describe, expect, it } from 'vitest';
import {
  analyseSeal,
  LOCK_FALL_MS,
  lockOffset,
  RUNES_DONE,
  runePixels,
  sealStage,
  sigilPixels,
  UNLOCK_AT,
  type SealArt,
} from './mythicSeal.js';

const SIZE = 16;
const VELVET = [0x1f, 0x21, 0x48];
const INK = [0x1e, 0x1a, 0x26];
const GOLD = [0xf6, 0xd3, 0x6b];
const TEAL = [0x8f, 0xd0, 0xc2];

/**
 * A 16×16 satchel: velvet everywhere, a gold lock (6..9 × 6..9) with an ink keyhole
 * and an ink ring, and three teal runes: x 2 (two pixels), 11 and 12.
 */
function sprite(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(SIZE * SIZE * 4);
  const put = (x: number, y: number, c: number[]) => {
    d.set([...c, 255], (y * SIZE + x) * 4);
  };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) put(x, y, VELVET);
  for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) put(x, y, INK);
  for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) put(x, y, GOLD);
  put(7, 7, INK);
  put(2, 8, TEAL);
  put(2, 9, TEAL);
  put(12, 10, TEAL);
  put(11, 8, TEAL);
  return d;
}

const ART: SealArt = {
  lock: { x0: 4, y0: 4, x1: 11, y1: 11 },
  runes: { x0: 0, y0: 7, x1: 15, y1: 10 },
};

describe('sealStage', () => {
  it('rattles, unlocks at UNLOCK_AT, then lights the runes up to RUNES_DONE', () => {
    expect(sealStage(0)).toEqual({ rattle: 0, unlocked: false, lit: 0 });
    expect(sealStage(UNLOCK_AT / 2)).toEqual({ rattle: 0.5, unlocked: false, lit: 0 });
    expect(sealStage(UNLOCK_AT)).toMatchObject({ rattle: 1, unlocked: true, lit: 0 });
    expect(sealStage((UNLOCK_AT + RUNES_DONE) / 2).lit).toBeCloseTo(0.5);
    expect(sealStage(RUNES_DONE).lit).toBe(1);
    expect(sealStage(2)).toEqual({ rattle: 1, unlocked: true, lit: 1 });
  });
});

describe('analyseSeal', () => {
  const seal = analyseSeal(sprite(), SIZE, ART);

  it('takes the gold lock with its ink ring and keyhole, not the velvet', () => {
    // 4×4 gold block (keyhole included) + the 16 ring pixels touching it (not the corners).
    expect(seal.lock).toHaveLength(16 + 16);
    expect(seal.lock.some((p) => p.x === 7 && p.y === 7)).toBe(true);
    expect(seal.lock.some((p) => p.x === 5 && p.y === 5)).toBe(false);
  });

  it('fills the hole from the satchel beside it', () => {
    expect(seal.hole).toHaveLength(seal.lock.length);
    expect(seal.hole.find((p) => p.x === 7 && p.y === 7)?.colour).toBe('#1f2148');
    expect(seal.hole.find((p) => p.x === 5 && p.y === 8)?.colour).toBe('#1f2148');
    expect(seal.hole.every((p) => p.colour !== '#f6d36b')).toBe(true);
  });

  it('puts the sigil where the padlock body was, teal at rest and gold when lit', () => {
    expect(seal.sigil).toEqual({ x: 8, y: 8 });
    const rest = sigilPixels(seal.sigil, false, false);
    const lit = sigilPixels(seal.sigil, true, false);
    expect(rest).toHaveLength(lit.length);
    expect(rest.find((p) => p.x === 8 && p.y === 6)?.colour).toBe('#8fd0c2');
    expect(lit.find((p) => p.x === 8 && p.y === 6)?.colour).toBe('#f6d36b');
    expect(lit.find((p) => p.x === 8 && p.y === 2)?.colour).toBe('#1e1a26');
  });

  it('groups teal runes into glyphs, nearest the lock first', () => {
    expect(seal.glyphs.map((g) => g.cx)).toEqual([11, 12, 2]);
    expect(seal.glyphs[2]?.pixels).toHaveLength(2);
  });

  it('lights glyphs in order and flings them out in the burst', () => {
    const centre = { x: 7.5, y: 8.5 };
    expect(runePixels(seal.glyphs, 0, 0, null, centre)).toHaveLength(0);
    const third = runePixels(seal.glyphs, 1 / 3, 0, null, centre);
    expect(third).toEqual([{ x: 11, y: 8, colour: '#fff8ec' }]);
    expect(runePixels(seal.glyphs, 1, 0, null, centre)).toHaveLength(4);
    const burst = runePixels(seal.glyphs, 1, 0, 0.75, centre);
    // Each glyph pixel burns white in place; only some fly off as sparks, upwards.
    expect(burst.filter((p) => p.colour === '#fff8ec')).toHaveLength(4);
    const sparks = burst.filter((p) => p.colour !== '#fff8ec');
    expect(sparks).toHaveLength(2);
    expect(sparks.every((p) => p.y < 8)).toBe(true);
  });
});

describe('lockOffset', () => {
  const locked = sealStage(0.2);
  const open = sealStage(0.5);

  it('rattles only before it opens, and keeps still with reduced effects', () => {
    const xs = new Set(
      Array.from({ length: 40 }, (_, i) => lockOffset(locked, null, i * 20, false)?.x),
    );
    expect(xs.size).toBeGreaterThan(1);
    expect(lockOffset(locked, null, 70, true)).toEqual({ x: 0, y: 0 });
  });

  it('hops, then falls out of view', () => {
    expect(lockOffset(open, 60, 0, false)?.y).toBeLessThan(0);
    expect(lockOffset(open, LOCK_FALL_MS * 0.9, 0, false)?.y).toBeGreaterThan(30);
    expect(lockOffset(open, LOCK_FALL_MS, 0, false)).toBeNull();
    expect(lockOffset(open, 0, 0, true)).toBeNull();
  });
});
