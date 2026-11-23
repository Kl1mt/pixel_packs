import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_FACE, MASTER_PALETTE } from '@pixel-packs/shared';
import { get, rgbaToHex } from '../compose/pixels.js';
import { decodePng } from '../png.js';
import { fromRepo } from '../paths.js';
import { CHUNKY_DIGITS, chunkyNumber } from './badges.js';

describe('chunky badge digits', () => {
  it('has 7-row glyphs for 0–9', () => {
    for (let d = 0; d <= 9; d++) expect(CHUNKY_DIGITS[String(d)]).toHaveLength(7);
  });

  it('keeps every stat value 0–12 inside the cream circle interior', () => {
    const frame = decodePng(
      readFileSync(fromRepo('apps/client/public/assets/frames/legendary.png')),
    );
    const light = new Set<string>([MASTER_PALETTE.cream, MASTER_PALETTE.glow]);
    for (const r of [CARD_FACE.atk, CARD_FACE.hp]) {
      for (let v = 0; v <= 12; v++) {
        const px = chunkyNumber(v, r.x + r.w / 2, r.y + r.h / 2, MASTER_PALETTE.ink);
        const outside = px.filter((p) => !light.has(rgbaToHex(get(frame, p.x, p.y))));
        expect(outside, `value ${String(v)}`).toEqual([]);
      }
    }
  });
});
