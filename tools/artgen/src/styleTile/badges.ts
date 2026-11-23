import { CARD_FACE, MASTER_PALETTE } from '@pixel-packs/shared';

/**
 * ATK/HP badge variants for the style-tile comparison (user feedback on v3:
 * numbers "still a bit hard to read"). Everything is drawn in art pixels as
 * crisp SVG rects, so it scales by the card's integer factor.
 */

/** Hand-pixelled chunky digits, 7 rows tall: 2 px vertical strokes, 1 px horizontals. */
export const CHUNKY_DIGITS: Record<string, readonly string[]> = {
  '0': ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  '1': ['.##', '###', '.##', '.##', '.##', '.##', '.##'],
  '2': ['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####'],
  '3': ['####.', '...##', '...##', '.###.', '...##', '...##', '####.'],
  '4': ['##.##', '##.##', '##.##', '#####', '...##', '...##', '...##'],
  '5': ['#####', '##...', '####.', '...##', '...##', '##.##', '.###.'],
  '6': ['.###.', '##...', '##...', '####.', '##.##', '##.##', '.###.'],
  '7': ['#####', '...##', '..##.', '..##.', '.##..', '.##..', '.##..'],
  '8': ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '.###.'],
  '9': ['.###.', '##.##', '##.##', '.####', '...##', '...##', '.###.'],
};

type Px = { x: number; y: number; c: string };

/** Pixels of a number in chunky digits, centred on (cx, cy) in art px; 1 px gap between digits. */
export function chunkyNumber(value: number, cx: number, cy: number, colour: string): Px[] {
  const glyphs = Array.from(String(value)).map((d) => CHUNKY_DIGITS[d] ?? []);
  const width = glyphs.reduce((w, g) => w + (g[0]?.length ?? 0), 0) + glyphs.length - 1;
  let x0 = Math.round(cx - width / 2);
  // Biased 1 px up: the circles narrow faster at the bottom than at the top.
  const y0 = Math.floor(cy - 4);
  const out: Px[] = [];
  for (const g of glyphs) {
    g.forEach((row, dy) => {
      Array.from(row).forEach((ch, dx) => {
        if (ch === '#') out.push({ x: x0 + dx, y: y0 + dy, c: colour });
      });
    });
    x0 += (g[0]?.length ?? 0) + 1;
  }
  return out;
}

/** A filled pixel disc with a 1 px rim and an optional inner ring, centred on (cx, cy). */
export function pixelDisc(
  cx: number,
  cy: number,
  size: number,
  fill: string,
  rim: string,
  ring?: string,
): Px[] {
  const out: Px[] = [];
  const r = size / 2;
  const x0 = Math.round(cx - r);
  const y0 = Math.round(cy - r);
  const inside = (x: number, y: number, rr: number) =>
    (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= rr * rr;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inside(x, y, r)) continue;
      const c = !inside(x, y, r - 1) ? rim : ring && !inside(x, y, r - 2) ? ring : fill;
      out.push({ x: x0 + x, y: y0 + y, c });
    }
  }
  return out;
}

export interface BadgeVariant {
  n: number;
  title: string;
  /** Pixels drawn over the card (art px, card coordinates). */
  pixels: (atk: number, hp: number, badgeMask: { atk: Px[]; hp: Px[] }, ringColour: string) => Px[];
  /** Text numbers instead of pixels: CSS font size. */
  fontPx?: (value: number) => number;
}

const P = MASTER_PALETTE;
const centre = (r: { x: number; y: number; w: number; h: number }) => ({
  cx: r.x + r.w / 2,
  cy: r.y + r.h / 2,
});

export const BADGE_VARIANTS: BadgeVariant[] = [
  {
    n: 1,
    title:
      'Bigger numbers: the pixel font at 48 px (3×, the card scale); two digits fall back to 32 px',
    pixels: () => [],
    fontPx: (v) => (v >= 10 ? 32 : 48),
  },
  {
    n: 2,
    title: 'Chunky hand-pixelled digits (5×7, 2 px strokes), ink on the cream circle',
    pixels: (atk, hp) => {
      const a = centre(CARD_FACE.atk);
      const h = centre(CARD_FACE.hp);
      return [...chunkyNumber(atk, a.cx, a.cy, P.ink), ...chunkyNumber(hp, h.cx, h.cy, P.ink)];
    },
  },
  {
    n: 3,
    title: 'Bigger 14×14 circle (material ring) with the pixel font at 48 px; two digits at 32 px',
    pixels: (_a, _h, _m, ring) =>
      [CARD_FACE.atk, CARD_FACE.hp].flatMap((r) => {
        const { cx, cy } = centre(r);
        return pixelDisc(cx, cy, 14, P.cream, P.ink, ring);
      }),
    fontPx: (v) => (v >= 10 ? 32 : 48),
  },
  {
    n: 4,
    title: 'Dark circle (ink fill) with cream chunky digits',
    pixels: (atk, hp, mask) => {
      const a = centre(CARD_FACE.atk);
      const h = centre(CARD_FACE.hp);
      return [
        ...mask.atk.map((p) => ({ ...p, c: P.ink })),
        ...mask.hp.map((p) => ({ ...p, c: P.ink })),
        ...chunkyNumber(atk, a.cx, a.cy, P.cream),
        ...chunkyNumber(hp, h.cx, h.cy, P.cream),
      ];
    },
  },
];

/** Crisp SVG of pixels over a 96×128 card at the card's CSS scale. */
export function pixelsSvg(pixels: Px[]): string {
  const rects = pixels.map(
    (p) => `<rect x="${String(p.x)}" y="${String(p.y)}" width="1" height="1" fill="${p.c}"/>`,
  );
  return `<svg class="overlay" viewBox="0 0 ${String(CARD_FACE.size.w)} ${String(CARD_FACE.size.h)}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}
