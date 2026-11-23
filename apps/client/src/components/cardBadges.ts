import {
  BADGE_GLYPH_HEIGHT,
  CARD_FACE,
  MASTER_PALETTE,
  badgeTextPixels,
  badgeTextWidth,
  type EditionStamp,
  type Stars,
  type Variant,
} from '@pixel-packs/shared';

/** One coloured art pixel on the 96×128 face. */
export interface FacePixel {
  x: number;
  y: number;
  colour: string;
}

export interface BadgeTraits {
  variant: Variant;
  stars: Stars;
  edition: EditionStamp | null;
  mintNumber: number | null;
}

const P = MASTER_PALETTE;
const WIN = CARD_FACE.art;
/** Badges sit 2 art px inside the art window's top corners. */
const INSET = 2;
const STAR_SIZE = 7;

/** 5×5 star; a 1 px ink outline (4-neighbour) makes it 7×7. */
const STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.'];

const MINT_PLATE: Partial<Record<Variant, { fill: string; text: string }>> = {
  void: { fill: P.night, text: P.lavender },
  glitch: { fill: P.ink, text: P.seafoam },
};
const EDITION_PLATE = { fill: P.berry, text: P.glow };

/** Text on a filled plate with a 1 px ink outline and 1 px padding: 9 px tall. */
function plate(text: string, x: number, y: number, fill: string, ink: string): FacePixel[] {
  const w = badgeTextWidth(text) + 4;
  const h = BADGE_GLYPH_HEIGHT + 4;
  const out: FacePixel[] = [];
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      const edge = dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
      out.push({ x: x + dx, y: y + dy, colour: edge ? P.ink : fill });
    }
  // Text pixels come last so they win when the renderer paints in order.
  for (const p of badgeTextPixels(text, x + 2, y + 2)) out.push({ ...p, colour: ink });
  return out;
}

function star(x: number, y: number): FacePixel[] {
  const fill = new Set<string>();
  STAR.forEach((row, dy) => {
    Array.from(row).forEach((c, dx) => {
      if (c === '#') fill.add(`${String(x + 1 + dx)},${String(y + 1 + dy)}`);
    });
  });
  const out: FacePixel[] = [];
  for (let py = y; py < y + STAR_SIZE; py++)
    for (let px = x; px < x + STAR_SIZE; px++) {
      const k = `${String(px)},${String(py)}`;
      // Amber body with a sunflower glint at the tip, so it reads on light and dark skies.
      if (fill.has(k)) out.push({ x: px, y: py, colour: py <= y + 2 ? P.sunflower : P.amber });
      else if (
        [-1, 1].some(
          (d) =>
            fill.has(`${String(px + d)},${String(py)}`) ||
            fill.has(`${String(px)},${String(py + d)}`),
        )
      )
        out.push({ x: px, y: py, colour: P.ink });
    }
  return out;
}

export function mintText(n: number): string {
  return `#${String(n)}`;
}

export function editionText(e: EditionStamp): string {
  return `1ST S${String(e.season)}`;
}

/**
 * Badge pixels for one copy (GDD §6), in the art window's top corners:
 * ★2/★3 stars top-left (★1 shows none), the First-Edition stamp under them,
 * and the Void/Glitch mint plate top-right.
 */
export function cardBadgePixels(t: BadgeTraits): FacePixel[] {
  const out: FacePixel[] = [];
  const top = WIN.y + INSET;
  let leftY = top;
  if (t.stars > 1) {
    for (let i = 0; i < t.stars; i++) out.push(...star(WIN.x + INSET + i * STAR_SIZE, top));
    leftY += STAR_SIZE + 1;
  }
  if (t.edition)
    out.push(
      ...plate(
        editionText(t.edition),
        WIN.x + INSET,
        leftY,
        EDITION_PLATE.fill,
        EDITION_PLATE.text,
      ),
    );
  const mint = MINT_PLATE[t.variant];
  if (mint && t.mintNumber !== null) {
    const text = mintText(t.mintNumber);
    const x = WIN.x + WIN.w - INSET - (badgeTextWidth(text) + 4);
    out.push(...plate(text, x, top, mint.fill, mint.text));
  }
  return out;
}
