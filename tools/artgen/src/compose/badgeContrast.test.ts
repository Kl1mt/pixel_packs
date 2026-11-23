import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_FACE, MASTER_PALETTE, RARITIES } from '@pixel-packs/shared';
import { decodePng } from '../png.js';
import { fromRepo } from '../paths.js';
import { contrastRatio, get, hexToRgba, opaque } from './pixels.js';

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

  it('computes WCAG ratios', () => {
    expect(contrastRatio([0, 0, 0, 255], [255, 255, 255, 255])).toBeCloseTo(21, 0);
  });
});
