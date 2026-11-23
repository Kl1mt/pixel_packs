import { describe, expect, it } from 'vitest';
import { RARITIES, VARIANTS } from '@pixel-packs/shared';
import { beatAt, cardShown, momentLabel, momentPlan } from './moment.js';
import { dithered, PixelBuffer, ringPixels, rgba, seeded, stepped } from './pixels.js';
import { claspPixels, Stardust } from './starhollow.js';

const card = (
  rarity: (typeof RARITIES)[number],
  variant: (typeof VARIANTS)[number] = 'normal',
) => ({
  rarity,
  variant,
  realm: 'starhollow' as const,
});

describe('momentPlan', () => {
  it('plays nothing for a plain Common to Epic', () => {
    for (const r of ['common', 'uncommon', 'rare', 'epic'] as const)
      expect(momentPlan(card(r), false)).toBeNull();
  });

  it('gives Legendary and Mythic their own sequences (GDD §5)', () => {
    expect(momentPlan(card('legendary'), false)?.beats.map((b) => b.beat)).toEqual([
      'dim',
      'rays',
      'descend',
      'crest',
    ]);
    expect(momentPlan(card('mythic'), false)?.beats.map((b) => b.beat)).toEqual([
      'takeover',
      'freeze',
      'cutscene',
      'shockwave',
      'descend',
      'crest',
    ]);
  });

  it('adds the variant stinger last, for every rarity × variant', () => {
    for (const r of RARITIES)
      for (const v of VARIANTS) {
        const plan = momentPlan(card(r, v), false);
        if (v === 'normal') continue;
        expect(plan?.beats.at(-1)?.beat).toBe(v);
      }
  });

  it('keeps reduced moments short and still', () => {
    for (const r of RARITIES)
      for (const v of VARIANTS) {
        const full = momentPlan(card(r, v), false);
        const reduced = momentPlan(card(r, v), true);
        expect(reduced === null).toBe(full === null);
        if (!full || !reduced) continue;
        expect(reduced.ms).toBeLessThan(full.ms);
        expect(reduced.beats.map((b) => b.beat)).not.toContain('descend');
        expect(reduced.ms).toBeLessThanOrEqual(2400);
      }
  });

  it('sums the beats', () => {
    const plan = momentPlan(card('legendary', 'foil'), false);
    expect(plan?.ms).toBe(plan?.beats.reduce((s, b) => s + b.ms, 0));
  });
});

describe('beatAt and cardShown', () => {
  const plan = momentPlan(card('legendary', 'glitch'), false);
  if (!plan) throw new Error('no plan');

  it('walks the timeline and ends', () => {
    expect(beatAt(plan, 0)).toEqual({ beat: 'dim', k: 0, index: 0 });
    expect(beatAt(plan, 350)?.beat).toBe('rays');
    expect(beatAt(plan, plan.ms - 1)?.beat).toBe('glitch');
    expect(beatAt(plan, plan.ms)).toBeNull();
  });

  it('hides the card until it descends', () => {
    expect(cardShown(plan, beatAt(plan, 100))).toBe(false);
    expect(cardShown(plan, beatAt(plan, 1100))).toBe(true);
    expect(cardShown(plan, null)).toBe(true);
  });

  it('shows a stinger-only card at once, and a reduced Legendary at its crest', () => {
    const foil = momentPlan(card('rare', 'foil'), false);
    if (!foil) throw new Error('no plan');
    expect(cardShown(foil, beatAt(foil, 0))).toBe(true);
    const still = momentPlan(card('legendary'), true);
    if (!still) throw new Error('no plan');
    expect(cardShown(still, beatAt(still, 0))).toBe(false);
    expect(cardShown(still, beatAt(still, still.ms - 1))).toBe(true);
  });

  it('labels the moment for screen readers', () => {
    expect(momentLabel(card('mythic', 'glitch'))).toBe(
      'Time stops: a Mythic card. Glitch variant.',
    );
  });
});

describe('pixel helpers', () => {
  it('writes palette colours as opaque RGBA', () => {
    const b = new PixelBuffer(2, 1);
    b.set(1, 0, rgba('#1e1a26'));
    expect([...b.bytes.slice(4, 8)]).toEqual([0x1e, 0x1a, 0x26, 255]);
    b.set(5, 5, 1);
    expect(b.get(0, 0)).toBe(0);
  });

  it('dithers to the asked coverage', () => {
    for (const level of [0, 0.25, 0.5, 0.75, 1]) {
      let on = 0;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (dithered(x, y, level)) on++;
      expect(on).toBe(level * 16);
    }
  });

  it('is deterministic and stepped', () => {
    expect(seeded(3)()).toBe(seeded(3)());
    expect(stepped(0.49, 4)).toBe(0.25);
    expect(new Set(ringPixels(0, 0, 5).map(([x, y]) => Math.round(Math.hypot(x, y)))).size).toBe(1);
  });
});

describe('Starhollow theme', () => {
  it('turns the moon clasp as the seam tears, full moon once open', () => {
    const lit = (ps: ReturnType<typeof claspPixels>) =>
      ps.filter((p) => p.colour !== '#343a7a').map((p) => `${String(p.x)},${String(p.y)}`);
    const start = lit(claspPixels(0, false));
    expect(lit(claspPixels(0.5, false))).not.toEqual(start);
    expect(lit(claspPixels(1, true)).length).toBeGreaterThan(start.length);
  });

  it('flings stardust outward after the burst', () => {
    const dust = new Stardust(12, seeded(1));
    const spread = () =>
      [...dust.pixels(0, 0, true, null), ...dust.pixels(0, 0, false, null)].reduce(
        (m, p) => Math.max(m, Math.abs(p.x)),
        0,
      );
    const before = spread();
    dust.step(0.5, 1, 0.2);
    expect(spread()).toBeGreaterThan(before);
  });
});
