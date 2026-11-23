import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREST_ORIGIN, CREST_SOCKET, MASTER_PALETTE, RARITIES } from '@pixel-packs/shared';
import { decodePng } from '../png.js';
import { fromRepo } from '../paths.js';
import { get, rgbaToHex } from './pixels.js';

/** The crest (T20) paints exactly the socket's light interior: check the mask against every frame. */
describe('crest socket', () => {
  const light = new Set<string>([
    MASTER_PALETTE.cream,
    MASTER_PALETTE.glow,
    MASTER_PALETTE.moonlight,
  ]);

  it.each(RARITIES)('CREST_SOCKET is the light interior of the %s socket', (rarity) => {
    const frame = decodePng(
      readFileSync(fromRepo(`apps/client/public/assets/frames/${rarity}.png`)),
    );
    CREST_SOCKET.forEach(([from, to], dy) => {
      const y = CREST_ORIGIN.y + dy;
      for (let dx = from - 1; dx <= to + 1; dx++) {
        const inside = dx >= from && dx <= to;
        const hex = rgbaToHex(get(frame, CREST_ORIGIN.x + dx, y));
        expect(light.has(hex), `(${String(CREST_ORIGIN.x + dx)}, ${String(y)})`).toBe(inside);
      }
    });
  });
});
