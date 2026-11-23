import { describe, expect, it } from 'vitest';
import { ENABLED_REALMS } from './odds.js';
import { MASTER_PALETTE, REALM_PALETTES, masterPaletteHex, realmPaletteHex } from './palettes.js';

describe('palettes', () => {
  it('master palette has 32 unique lowercase hex colours', () => {
    const hex = masterPaletteHex();
    expect(hex).toHaveLength(32);
    expect(new Set(hex).size).toBe(32);
    for (const c of hex) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('every enabled realm has an 8–16 colour sub-palette drawn from the master palette', () => {
    for (const realm of ENABLED_REALMS) {
      const palette = REALM_PALETTES[realm];
      expect(palette, realm).toBeDefined();
      const names = palette?.colours ?? [];
      expect(names.length).toBeGreaterThanOrEqual(8);
      expect(names.length).toBeLessThanOrEqual(16);
      expect(new Set(names).size).toBe(names.length);
      for (const n of names) expect(MASTER_PALETTE[n]).toBeDefined();
      expect(realmPaletteHex(realm)).toHaveLength(names.length);
    }
  });

  it('throws for a realm without a palette yet', () => {
    expect(() => realmPaletteHex('tidepool')).toThrow();
  });
});
