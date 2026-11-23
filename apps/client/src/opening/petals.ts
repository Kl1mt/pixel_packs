/** A falling petal or leaf in scene art px (drawn snapped to whole pixels). */
export interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colour: string;
  phase: number;
  age: number;
}

/** Two flutter frames: a flat petal and a turned one (offsets in art px). */
const FRAMES: readonly (readonly [number, number][])[] = [
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
  ],
];

/** The pixels of a petal this frame. */
export function petalPixels(p: Petal): [number, number][] {
  const frame = FRAMES[Math.floor(p.age / 0.28 + p.phase) % 2] ?? FRAMES[0] ?? [];
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  return frame.map(([dx, dy]) => [x + dx, y + dy]);
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

/** A petal drifting in from the top edge somewhere across `width`. */
export function ambientPetal(width: number, colours: readonly string[], r: () => number): Petal {
  return {
    x: r() * width,
    y: -2,
    vx: 0,
    vy: 4 + r() * 4,
    colour: colours[Math.floor(r() * colours.length)] ?? '#fff',
    phase: r(),
    age: 0,
  };
}

/** A petal thrown up and out of the tear at (`x`, `y`). */
export function burstPetal(
  x: number,
  y: number,
  colours: readonly string[],
  r: () => number,
): Petal {
  const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
  const speed = 24 + r() * 30;
  return {
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    colour: colours[Math.floor(r() * colours.length)] ?? '#fff',
    phase: r(),
    age: 0,
  };
}
