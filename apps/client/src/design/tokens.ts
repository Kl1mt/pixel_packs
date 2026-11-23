import {
  CARD_SCALE,
  HEADING_FONT,
  MASTER_PALETTE,
  UI_BUTTON,
  UI_PANELS,
  UI_SCALE,
  type PaletteColourName,
} from '@pixel-packs/shared';

/**
 * Design tokens (GDD §16). Colours come only from the master palette, lengths are
 * counted in art pixels and scaled by one integer per context: `UI_SCALE` for
 * menus and panels, `CARD_SCALE` for cards and packs. The approved T06 style
 * tile (`tools/artgen/src/styleTile/css.ts`) is the visual reference.
 */

/** Screen px for `n` art pixels at the menu scale. */
export const ui = (n: number): number => n * UI_SCALE;
/** Screen px for `n` art pixels at the card scale. */
export const cardPx = (n: number): number => n * CARD_SCALE;
const px = (n: number) => `${String(n)}px`;

/** The four text sizes (§16: no more than ~4). Pixel-font sizes are whole multiples of its 16 px glyph. */
export const TYPE = {
  display: { size: 48, font: 'heading' },
  heading: { size: 32, font: 'heading' },
  body: { size: 18, font: 'body' },
  small: { size: 16, font: 'body' },
} as const;
export type TypeStep = keyof typeof TYPE;

export const FONT_STACKS = {
  heading: `'${HEADING_FONT.family}', monospace`,
  body: `'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`,
} as const;

/** Spacing steps in art pixels (`--sp-<n>` = n art px at `UI_SCALE`). */
export const SPACE = [1, 2, 3, 4, 6, 8, 12, 16] as const;

/** Hard, unblurred offset shadows in ink (§16: 2–4 screen px). */
export const SHADOWS = {
  sm: `${px(ui(1))} ${px(ui(1))} 0 var(--ink)`,
  md: `${px(ui(2))} ${px(ui(2))} 0 var(--ink)`,
} as const;

/** Semantic colour roles; each points at a palette entry. */
export const ROLES = {
  page: 'barkDeep',
  ground: 'mossDeep',
  text: 'ink',
  textMuted: 'dusk',
  textOnWood: 'glow',
  textOnWoodMuted: 'straw',
  focus: 'sunflower',
  accent: 'sunflower',
  danger: 'berry',
} as const satisfies Record<string, PaletteColourName>;

/** UI motion (§16: 120–250 ms with a slight cozy overshoot). */
export const MOTION = {
  fast: 120,
  base: 180,
  slow: 250,
  overshoot: 'cubic-bezier(.3,1.6,.5,1)',
} as const;

const slice = (s: readonly number[]) => s.join(' ');
const sliceWidth = (s: readonly number[]) => s.map((n) => px(ui(n))).join(' ');

/** `:root` custom properties plus the 9-slice rules, injected once at startup. */
export function tokenCss(): string {
  const vars: string[] = [
    ...Object.entries(MASTER_PALETTE).map(([k, v]) => `--${k}: ${v};`),
    ...Object.entries(ROLES).map(([k, v]) => `--role-${k}: var(--${v});`),
    `--ui: ${String(UI_SCALE)};`,
    `--card: ${String(CARD_SCALE)};`,
    `--art-px: ${px(ui(1))};`,
    ...SPACE.map((n) => `--sp-${String(n)}: ${px(ui(n))};`),
    ...Object.entries(TYPE).map(([k, v]) => `--${k}: ${px(v.size)};`),
    `--font-heading: ${FONT_STACKS.heading};`,
    `--font-body: ${FONT_STACKS.body};`,
    ...Object.entries(SHADOWS).map(([k, v]) => `--shadow-${k}: ${v};`),
    ...Object.entries(MOTION).map(([k, v]) =>
      typeof v === 'number' ? `--motion-${k}: ${String(v)}ms;` : `--motion-${k}: ${v};`,
    ),
  ];
  const panels = Object.entries(UI_PANELS).map(
    ([name, p]) =>
      `.panel--${name} { border-image: url('${p.file}') ${slice(p.slice)} fill stretch; border-width: ${sliceWidth(p.slice)}; }`,
  );
  const b = UI_BUTTON;
  return [
    `@font-face { font-family: '${HEADING_FONT.family}'; src: url('${HEADING_FONT.file}') format('truetype'); font-display: block; }`,
    `:root { ${vars.join(' ')} }`,
    ...panels,
    `.btn { border-image: url('${b.file('rest')}') ${slice(b.slice)} fill stretch; border-width: ${sliceWidth(b.slice)}; min-height: ${px(ui(b.h))}; }`,
    `.btn:hover:not(:disabled) { border-image-source: url('${b.file('hover')}'); }`,
    `.btn:active:not(:disabled), .btn.is-pressed { border-image-source: url('${b.file('pressed')}'); }`,
    `.btn:disabled { border-image-source: url('${b.file('disabled')}'); }`,
  ].join('\n');
}

/** Adds the token stylesheet to `<head>` (before the app's own CSS so it can be overridden). */
export function installTokens(doc: Document = document): void {
  if (doc.getElementById('pp-tokens')) return;
  const style = doc.createElement('style');
  style.id = 'pp-tokens';
  style.textContent = tokenCss();
  doc.head.prepend(style);
}
