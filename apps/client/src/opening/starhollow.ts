import { MASTER_PALETTE as P } from '@pixel-packs/shared';

/** The moon medallion on the Starhollow satchel (pack-local art px, measured on the sprite). */
export const CLASP = { x: 33.5, y: 42, face: 7.3 } as const;
/** Where the crescent's shadow sits at rest (radians): the sprite's moon opens to the right. */
const REST = -0.35;

export interface PackPixel {
  x: number;
  y: number;
  colour: string;
}

/**
 * The moon clasp (GDD §3): the crescent turns three quarters of the way round as the
 * seam tears, and shows a full moon once the pack gives way.
 */
export function claspPixels(progress: number, open: boolean): PackPixel[] {
  const out: PackPixel[] = [];
  const turn = REST + Math.min(1, progress) * Math.PI * 1.5;
  const sx = CLASP.x + Math.cos(turn) * 2.6;
  const sy = CLASP.y + Math.sin(turn) * 2.6;
  const r = Math.ceil(CLASP.face);
  for (let y = Math.floor(CLASP.y) - r; y <= CLASP.y + r; y++)
    for (let x = Math.floor(CLASP.x) - r; x <= CLASP.x + r; x++) {
      const d = Math.hypot(x + 0.5 - CLASP.x, y + 0.5 - CLASP.y);
      if (d > CLASP.face) continue;
      let colour: string = P.indigo;
      if (d <= 5.5) {
        const lit = open || Math.hypot(x + 0.5 - sx, y + 0.5 - sy) > 4.6;
        if (lit) colour = open && d < 3 ? P.glow : d > 4.5 ? P.moonlight : P.lavender;
      }
      out.push({ x, y, colour });
    }
  return out;
}

/** One stardust mote on its tilted orbit round the pack. */
interface Mote {
  a: number;
  r: number;
  speed: number;
  colour: string;
  lift: number;
}

const DUST = [P.lavender, P.moonlight, P.silver, P.lilac, P.sunflower] as const;
/** The orbit's tilt: how flat the ellipse is. */
const FLAT = 0.32;

/**
 * Stardust swirling round the satchel (GDD §3). It spins faster as the seam tears;
 * when the pack bursts, the motes spiral up and out and fade.
 */
export class Stardust {
  private motes: Mote[];

  constructor(count: number, r: () => number) {
    this.motes = Array.from({ length: count }, (_, i) => ({
      a: r() * Math.PI * 2,
      r: 30 + r() * 14,
      speed: 0.5 + r() * 0.6,
      colour: DUST[i % DUST.length] ?? P.lavender,
      lift: (r() - 0.5) * 10,
    }));
  }

  /** Advances `dt` s; `tear` 0–1 speeds the swirl, `burst` (0–1, or null) flings it out. */
  step(dt: number, tear: number, burst: number | null): void {
    for (const m of this.motes) {
      m.a += dt * m.speed * (1 + tear * 2.5 + (burst === null ? 0 : 3));
      if (burst !== null) {
        m.r += dt * 60 * (0.6 + m.speed);
        m.lift -= dt * 26;
      }
    }
  }

  /** The motes behind (`back`) or in front of the pack, around its centre (cx, cy). */
  pixels(cx: number, cy: number, back: boolean, burst: number | null): PackPixel[] {
    const out: PackPixel[] = [];
    this.motes.forEach((m, i) => {
      const behind = Math.sin(m.a) < 0;
      if (behind !== back) return;
      // Fading out after the burst: fewer motes each step.
      if (burst !== null && (i % 4) / 4 < burst) return;
      const x = Math.round(cx + Math.cos(m.a) * m.r);
      const y = Math.round(cy + Math.sin(m.a) * m.r * FLAT + m.lift);
      out.push({ x, y, colour: m.colour });
      // Bright motes trail a pixel behind them.
      if (i % 3 === 0)
        out.push({
          x: Math.round(cx + Math.cos(m.a - 0.08) * m.r),
          y,
          colour: behind ? P.indigo : P.periwinkle,
        });
    });
    return out;
  }
}
