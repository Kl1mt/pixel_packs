/**
 * UI art from T06 (GDD §16), served from `apps/client/public/assets/`. Sizes and
 * 9-slice insets are in art pixels; the client scales them by one integer factor
 * per context (`UI_SCALE` for menus).
 */
export interface NineSlice {
  readonly file: string;
  readonly w: number;
  readonly h: number;
  /** CSS `border-image-slice` order: top, right, bottom, left. */
  readonly slice: readonly [number, number, number, number];
}

/** 1 art pixel = 2 screen px in menus and panels (cards use `CARD_SCALE`). */
export const UI_SCALE = 2;
/** 1 art pixel = 3 screen px for cards and packs in the binder and opening scene. */
export const CARD_SCALE = 3;

export const UI_PANELS = {
  parchment: { file: '/assets/ui/panel-parchment.png', w: 117, h: 117, slice: [12, 12, 12, 12] },
  wood: { file: '/assets/ui/panel-wood.png', w: 117, h: 117, slice: [14, 14, 14, 14] },
} as const satisfies Record<string, NineSlice>;

export const BUTTON_STATES = ['rest', 'hover', 'pressed', 'disabled'] as const;
export type ButtonState = (typeof BUTTON_STATES)[number];

/** Chunky wood button, 81×25; the bottom 4 rows are its hard dark edge. */
export const UI_BUTTON = {
  w: 81,
  h: 25,
  slice: [7, 8, 9, 8] as const,
  file: (state: ButtonState) => `/assets/ui/button-${state}.png`,
};

export const ICONS = [
  'gold',
  'gem',
  'stardust',
  'timer',
  'nav-home',
  'nav-packs',
  'nav-binder',
  'cursor',
] as const;
export type IconName = (typeof ICONS)[number];
export const ICON_SIZE = 16;
export const iconFile = (name: IconName) => `/assets/icons/${name}.png`;

export const HEADING_FONT = {
  family: 'Pixel Packs Hollow',
  file: '/assets/fonts/pixel-packs-hollow.ttf',
  /** Native glyph size; use multiples of it only. */
  glyphPx: 16,
} as const;
