import { describe, expect, it } from 'vitest';
import { CARD_FACE, MASTER_PALETTE, RARITIES, frameMaterialHex } from '@pixel-packs/shared';
import { allFrames, sourceRow } from './frames.js';
import { reduceIcon } from './icons.js';
import { blank, cropToMainBody, get, hexToRgba, opaque, rgbaToHex, set } from './pixels.js';

/** A fake 96×128 base: wood everywhere, a glow window, so the reshaping logic is exercised. */
function fakeBase() {
  const png = blank(96, 128);
  const wood = hexToRgba(MASTER_PALETTE.wood);
  const glow = hexToRgba(MASTER_PALETTE.glow);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 96; x++) set(png, x, y, wood);
  for (let y = 15; y <= 63; y++) for (let x = 14; x <= 81; x++) set(png, x, y, glow);
  return png;
}

describe('sourceRow', () => {
  it('maps 128 rows onto the base, keeping the top and bottom in place', () => {
    const rows = Array.from({ length: 128 }, (_, y) => sourceRow(y));
    expect(rows.slice(0, 37)).toEqual(Array.from({ length: 37 }, (_, i) => i));
    expect(sourceRow(78)).toBe(63);
    expect(sourceRow(79)).toBe(64);
    expect(sourceRow(107)).toBe(92);
    expect(rows.slice(108)).toEqual(Array.from({ length: 20 }, (_, i) => 108 + i));
  });
});

describe('rarity frames', () => {
  const frames = allFrames(fakeBase());

  it('cuts an exact transparent 64×64 art window with an ink rim', () => {
    const { art } = CARD_FACE;
    const f = frames.common;
    for (let y = art.y; y < art.y + art.h; y++)
      for (let x = art.x; x < art.x + art.w; x++) expect(get(f, x, y)[3]).toBe(0);
    expect(rgbaToHex(get(f, art.x - 1, art.y + 10))).toBe(MASTER_PALETTE.ink);
    expect(rgbaToHex(get(f, art.x + art.w, art.y + 10))).toBe(MASTER_PALETTE.ink);
    expect(rgbaToHex(get(f, art.x + 5, art.y + art.h))).toBe(MASTER_PALETTE.ink);
  });

  it('swaps the wood ramp per rarity and fills 1–6 pips', () => {
    RARITIES.forEach((r, i) => {
      const { ramp, pip } = frameMaterialHex(r);
      expect(rgbaToHex(get(frames[r], 2, 60))).toBe(ramp[2]);
      const lit = CARD_FACE.pips.filter((p) => rgbaToHex(get(frames[r], p.x + 2, p.y + 2)) === pip);
      expect(lit).toHaveLength(i + 1);
    });
  });
});

describe('icons', () => {
  it('reduces a 32×32 icon to 16×16 with a 1 px ink outline', () => {
    const src = blank(32, 32);
    const gold = hexToRgba(MASTER_PALETTE.amber);
    for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) set(src, x, y, gold);
    const icon = reduceIcon(src);
    expect([icon.width, icon.height]).toEqual([16, 16]);
    expect(rgbaToHex(get(icon, 8, 8))).toBe(MASTER_PALETTE.amber);
    expect(rgbaToHex(get(icon, 3, 8))).toBe(MASTER_PALETTE.ink);
    expect(opaque(get(icon, 0, 0))).toBe(false);
  });
});

describe('cropToMainBody', () => {
  it('drops a stray sliver separated by transparent columns', () => {
    const png = blank(20, 10);
    const c = hexToRgba(MASTER_PALETTE.wood);
    for (let y = 0; y < 10; y++) set(png, 0, y, c);
    for (let y = 2; y < 8; y++) for (let x = 5; x < 18; x++) set(png, x, y, c);
    const out = cropToMainBody(png);
    expect([out.width, out.height]).toEqual([13, 6]);
  });
});
