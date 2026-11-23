import { describe, expect, it } from 'vitest';
import { CARD_FACE } from './cardFace.js';
import { ENABLED_REALMS } from './odds.js';
import { MASTER_PALETTE } from './palettes.js';
import { CREST_ORIGIN, CREST_SOCKET, REALM_CRESTS, realmCrestPixels } from './realmCrests.js';

describe('realm crests', () => {
  const palette = new Set<string>(Object.values(MASTER_PALETTE));

  it('exist for every realm with cards', () => {
    for (const realm of ENABLED_REALMS)
      expect(realmCrestPixels(realm).length, realm).toBeGreaterThan(0);
    expect(realmCrestPixels('tidepool')).toEqual([]);
  });

  it.each(Object.entries(REALM_CRESTS))(
    '%s is an 11×11 grid painted only inside the socket, in palette colours',
    (_realm, art) => {
      expect(art.rows).toHaveLength(CREST_SOCKET.length);
      art.rows.forEach((row, y) => {
        expect(row).toHaveLength(11);
        const [from, to] = CREST_SOCKET[y] ?? [0, -1];
        Array.from(row).forEach((c, x) => {
          if (c !== '.')
            expect(x >= from && x <= to, `row ${String(y)} col ${String(x)}`).toBe(true);
        });
      });
      expect(Object.values(art.keys).every((k) => palette.has(MASTER_PALETTE[k]))).toBe(true);
    },
  );

  it('fills the CARD_FACE crest socket (Starhollow covers all of it)', () => {
    const c = CARD_FACE.crest;
    expect(CREST_ORIGIN).toEqual({ x: c.x, y: c.y });
    const px = realmCrestPixels('starhollow');
    const area = CREST_SOCKET.reduce((n, [a, b]) => n + b - a + 1, 0);
    expect(px).toHaveLength(area);
    expect(Math.max(...px.map((p) => p.x))).toBe(c.x + c.w - 1);
    expect(Math.max(...px.map((p) => p.y))).toBe(c.y + c.h - 1);
  });
});
