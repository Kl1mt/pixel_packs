import { describe, expect, it } from 'vitest';
import { CARD_FACE, MASTER_PALETTE } from '@pixel-packs/shared';
import { CARD_FRAGMENT } from './cardShader.js';
import { glslRgb } from './colour.js';
import { PALETTE_SIZE, PALETTE_UNIFORM, TEXT_AREA } from './glsl.js';
import { FOIL_REST, FOIL_SWEEP, foilDiagonal, foilLight } from './motion.js';

describe('card shader source', () => {
  it('passes the whole master palette for snapping', () => {
    expect(PALETTE_SIZE).toBe(Object.keys(MASTER_PALETTE).length);
    expect(PALETTE_UNIFORM).toHaveLength(PALETTE_SIZE * 3);
    expect(Array.from(glslRgb(MASTER_PALETTE.ink))).toEqual(
      Array.from(PALETTE_UNIFORM.slice(0, 3)),
    );
    expect(CARD_FRAGMENT).toContain(`uniform vec3 uPalette[${String(PALETTE_SIZE)}]`);
  });

  it('stays GLSL ES 1.0 friendly (WebGL1 fallback): no array constructors or int uniforms', () => {
    expect(CARD_FRAGMENT).not.toMatch(/vec3\[\]|\[\]\s*\(/);
    expect(CARD_FRAGMENT).not.toMatch(/uniform\s+int/);
  });

  it('protects the name and rules boxes but not the art window', () => {
    const a = CARD_FACE.art;
    for (const r of [CARD_FACE.name, CARD_FACE.rules]) {
      expect(r.x).toBeGreaterThanOrEqual(TEXT_AREA.x);
      expect(r.y).toBeGreaterThanOrEqual(TEXT_AREA.y);
      expect(r.x + r.w).toBeLessThanOrEqual(TEXT_AREA.x + TEXT_AREA.w);
      expect(r.y + r.h).toBeLessThanOrEqual(TEXT_AREA.y + TEXT_AREA.h);
    }
    expect(TEXT_AREA.y).toBeGreaterThanOrEqual(a.y + a.h - 1);
  });
});

describe('foil light', () => {
  it('sweeps across the card, then rests off it', () => {
    const early = foilLight(0, 0.1, null, false);
    const late = foilLight(0, FOIL_SWEEP.cross * 0.9, null, false);
    expect(late).toBeGreaterThan(early);
    expect(foilLight(0, FOIL_SWEEP.cross + 0.5, null, false)).toBeLessThan(0);
  });

  it('eases to the pointer and holds still without one in the reduced version', () => {
    const target = foilDiagonal({ x: 40, y: 60 });
    let light = 0;
    for (let i = 0; i < 30; i++) light = foilLight(light, i / 60, { x: 40, y: 60 }, false);
    expect(light).toBe(target);
    expect(foilLight(FOIL_REST, 1, null, true)).toBe(FOIL_REST);
    expect(foilLight(FOIL_REST, 2.7, null, true)).toBe(FOIL_REST);
  });
});
