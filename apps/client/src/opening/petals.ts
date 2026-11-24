/**
 * Falling petals and leaves (T12; sprites since T22). A petal is drawn in scene art px,
 * snapped to whole pixels. Mossgrove uses small hand-drawn sprites that tumble: they
 * turn in quarter steps and flip over (narrowing to edge-on and showing their shaded
 * back). A look without a shape is a 2 px mote (Starhollow's falling sparkle).
 */

/** Hand-drawn petal and leaf shapes: `#` face colour, `+` shade colour, `.` clear. */
export const PETAL_SHAPES = {
  /** A blossom petal with a notched tip. */
  blossom: ['#.#', '###', '###', '.+.'],
  /** A rounder, wider petal. */
  round: ['.##.', '####', '.++.'],
  /** A slim petal, curling to one side. */
  slim: ['.#', '##', '#+', '+.'],
  /** A tiny leaf with its midrib in shade. */
  leaf: ['..#', '.#+', '#+.', '+..'],
} as const satisfies Record<string, readonly string[]>;

export type PetalShape = keyof typeof PETAL_SHAPES;

/** What a theme drops: a palette colour, its shade, and a sprite shape (null: a mote). */
export interface PetalLook {
  colour: string;
  shade: string;
  shape: PetalShape | null;
}

/** Looks of 2 px motes in these colours (no sprite). */
export const motes = (colours: readonly string[]): PetalLook[] =>
  colours.map((colour) => ({ colour, shade: colour, shape: null }));

export interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  look: PetalLook;
  /** 0–1, de-syncs the flutter of petals spawned together. */
  phase: number;
  /** Tumble speed in turns per second, signed (spin direction). */
  spin: number;
  age: number;
}

/** Two flutter frames of a mote: a flat pixel pair and a turned one. */
const MOTE: readonly (readonly [number, number][])[] = [
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
  ],
];

type Grid = readonly string[];

/** The grid turned a quarter clockwise. */
function quarter(g: Grid): Grid {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  return Array.from({ length: w }, (_, x) =>
    Array.from({ length: h }, (_, y) => g[h - 1 - y]?.[x] ?? '.').join(''),
  );
}

/** The grid squeezed to `w` columns (nearest column), as a petal turning edge-on. */
function squeeze(g: Grid, w: number): Grid {
  const from = g[0]?.length ?? 0;
  if (w >= from) return g;
  return g.map((row) =>
    Array.from({ length: w }, (_, x) => row[Math.floor(((x + 0.5) * from) / w)] ?? '.').join(''),
  );
}

/**
 * The sprite frame of a petal at its age: the quarter-turn it has spun to, and how far
 * it has flipped over (full face, narrower, edge-on, then its shaded back).
 */
export function petalFrame(shape: PetalShape, age: number, phase: number, spin: number): Grid {
  const turn = phase + age * spin;
  let g: Grid = PETAL_SHAPES[shape];
  const q = ((Math.floor(turn * 4) % 4) + 4) % 4;
  for (let i = 0; i < q; i++) g = quarter(g);
  // Flipping runs at its own pace, so turning and flipping don't lock together.
  const flip = Math.cos((phase * 3 + age * Math.abs(spin) * 1.7) * Math.PI * 2);
  const w = g[0]?.length ?? 1;
  const narrow = Math.max(1, Math.round(w * Math.abs(flip)));
  g = squeeze(g, narrow);
  // The back of the petal: face and shade swap.
  if (flip < 0) g = g.map((row) => row.replace(/[#+]/g, (c) => (c === '#' ? '+' : '#')));
  return g;
}

/** The coloured pixels of a petal this frame. */
export function petalPixels(p: Petal): [number, number, string][] {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const { shape, colour, shade } = p.look;
  if (!shape) {
    const frame = MOTE[Math.floor(p.age / 0.28 + p.phase) % 2] ?? MOTE[0] ?? [];
    return frame.map(([dx, dy]) => [x + dx, y + dy, colour]);
  }
  const out: [number, number, string][] = [];
  petalFrame(shape, p.age, p.phase, p.spin).forEach((row, dy) => {
    Array.from(row).forEach((c, dx) => {
      if (c !== '.') out.push([x + dx, y + dy, c === '#' ? colour : shade]);
    });
  });
  return out;
}

/** Moves petals by `dt` seconds: gravity to a slow terminal speed, sway, and drops those below `floor`. */
export function stepPetals(petals: Petal[], dt: number, floor: number): Petal[] {
  return petals
    .map((p) => {
      const vy = Math.min(p.vy + 30 * dt, 14);
      const sway = Math.sin(p.age * 2.2 + p.phase * 6) * 6;
      return {
        ...p,
        age: p.age + dt,
        vx: p.vx * (1 - Math.min(1, 2 * dt)),
        vy,
        x: p.x + (p.vx + sway) * dt,
        y: p.y + vy * dt,
      };
    })
    .filter((p) => p.y < floor);
}

const pick = (looks: readonly PetalLook[], r: () => number): PetalLook =>
  looks[Math.floor(r() * looks.length)] ?? { colour: '#fff', shade: '#fff', shape: null };

/** A slow tumble, either way round: 0.35–0.8 turns per second. */
const spinOf = (r: () => number) => (0.35 + r() * 0.45) * (r() < 0.5 ? -1 : 1);

/** A petal drifting in from the top edge somewhere across `width`. */
export function ambientPetal(width: number, looks: readonly PetalLook[], r: () => number): Petal {
  return {
    x: r() * width,
    y: -4,
    vx: 0,
    vy: 4 + r() * 4,
    look: pick(looks, r),
    phase: r(),
    spin: spinOf(r),
    age: 0,
  };
}

/** A petal thrown up and out of the tear at (`x`, `y`); it spins faster at first. */
export function burstPetal(
  x: number,
  y: number,
  looks: readonly PetalLook[],
  r: () => number,
): Petal {
  const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
  const speed = 24 + r() * 30;
  return {
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    look: pick(looks, r),
    phase: r(),
    spin: spinOf(r) * 1.6,
    age: 0,
  };
}
