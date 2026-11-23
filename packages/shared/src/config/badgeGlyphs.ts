/**
 * Tiny 5-row pixel glyphs (3 wide; "#" is 5) for card-face badges (T11): mint numbers ("#12") and
 * First-Edition stamps ("1ST S1"). Drawn in art pixels like the stat digits,
 * so they scale with the card and stay on the pixel grid.
 */
export const BADGE_GLYPHS: Readonly<Record<string, readonly string[]>> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '#': ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  ' ': ['.', '.', '.', '.', '.'],
};

export const BADGE_GLYPH_HEIGHT = 5;

function glyph(ch: string): readonly string[] {
  const g = BADGE_GLYPHS[ch];
  if (!g) throw new Error(`no badge glyph for ${JSON.stringify(ch)}`);
  return g;
}

/** Width in art px of `text` (1 px between glyphs). */
export function badgeTextWidth(text: string): number {
  const chars = Array.from(text);
  return chars.reduce((w, ch) => w + (glyph(ch)[0]?.length ?? 0), 0) + chars.length - 1;
}

/** Pixels of `text` with its top-left at (x, y). */
export function badgeTextPixels(text: string, x: number, y: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let cx = x;
  for (const ch of Array.from(text)) {
    const g = glyph(ch);
    g.forEach((row, dy) => {
      Array.from(row).forEach((c, dx) => {
        if (c === '#') out.push({ x: cx + dx, y: y + dy });
      });
    });
    cx += (g[0]?.length ?? 0) + 1;
  }
  return out;
}
