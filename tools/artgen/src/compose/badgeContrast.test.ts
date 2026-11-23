import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_FACE, MASTER_PALETTE, RARITIES, statDigitPixels } from '@pixel-packs/shared';
import { decodePng } from '../png.js';
import { fromRepo } from '../paths.js';
import { contrastRatio, get, hexToRgba, opaque, rgbaToHex } from './pixels.js';

/** ATK/HP numbers are drawn in ink on the badge circles (style-tile feedback): check every frame. */
describe('ATK/HP badge contrast', () => {
  const ink = hexToRgba(MASTER_PALETTE.ink);

  it.each(RARITIES)('ink numbers reach ≥ 4.5:1 on the %s badges', (rarity) => {
    const frame = decodePng(
      readFileSync(fromRepo(`apps/client/public/assets/frames/${rarity}.png`)),
    );
    let worst = Infinity;
    for (const r of [CARD_FACE.atk, CARD_FACE.hp]) {
      // The number sits in the middle of the circle: check its central 6×7 area.
      for (let y = r.y + 2; y < r.y + r.h - 2; y++) {
        for (let x = r.x + 2; x < r.x + r.w - 2; x++) {
          const c = get(frame, x, y);
          if (opaque(c)) worst = Math.min(worst, contrastRatio(ink, c));
        }
      }
    }
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });

  it.each(RARITIES)(
    'keeps the digits of every stat 0–12 on the cream of the %s badges',
    (rarity) => {
      const frame = decodePng(
        readFileSync(fromRepo(`apps/client/public/assets/frames/${rarity}.png`)),
      );
      const light = new Set<string>([MASTER_PALETTE.cream, MASTER_PALETTE.glow]);
      for (const r of [CARD_FACE.atk, CARD_FACE.hp]) {
        for (let v = 0; v <= 12; v++) {
          const outside = statDigitPixels(v, r).filter(
            (p) => !light.has(rgbaToHex(get(frame, p.x, p.y))),
          );
          expect(outside, `value ${String(v)}`).toEqual([]);
        }
      }
    },
  );

  it('computes WCAG ratios', () => {
    expect(contrastRatio([0, 0, 0, 255], [255, 255, 255, 255])).toBeCloseTo(21, 0);
  });
});
