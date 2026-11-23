import type { Rect } from './cardFace.js';

/**
 * ATK/HP numbers on the card face (T06, user pick "variant 2"): hand-pixelled
 * chunky digits, 7 rows tall, 2 px vertical and 1 px horizontal strokes, drawn
 * in ink on the cream badge circles in art pixels (so they scale with the card).
 */
export const STAT_DIGITS: Readonly<Record<string, readonly string[]>> = {
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

export const STAT_DIGIT_HEIGHT = 7;
/** Gap between the two digits of a two-digit value. */
export const STAT_DIGIT_GAP = 1;

/** Width in art px of a value's glyph run (e.g. 5 for "3", 9 for "12"). */
export function statRunWidth(value: number): number {
  const glyphs = Array.from(String(value)).map((d) => STAT_DIGITS[d]?.[0]?.length ?? 0);
  return glyphs.reduce((a, b) => a + b, 0) + STAT_DIGIT_GAP * (glyphs.length - 1);
}

/**
 * Pixels of `value` centred in a badge interior (default: the ATK or HP circle).
 * Centring is exact where the parity allows. Otherwise the leftover pixel goes to
 * the right/bottom (floor rounding), so the run is at most ½ px left of or above centre.
 * Values are 0–99; the catalog never exceeds 12.
 */
export function statDigitPixels(value: number, box: Rect): { x: number; y: number }[] {
  if (!Number.isInteger(value) || value < 0 || value > 99)
    throw new Error(`bad stat ${String(value)}`);
  let x = box.x + Math.floor((box.w - statRunWidth(value)) / 2);
  const y0 = box.y + Math.floor((box.h - STAT_DIGIT_HEIGHT) / 2);
  const out: { x: number; y: number }[] = [];
  for (const d of Array.from(String(value))) {
    const glyph = STAT_DIGITS[d] ?? [];
    glyph.forEach((row, dy) => {
      Array.from(row).forEach((ch, dx) => {
        if (ch === '#') out.push({ x: x + dx, y: y0 + dy });
      });
    });
    x += (glyph[0]?.length ?? 0) + STAT_DIGIT_GAP;
  }
  return out;
}
