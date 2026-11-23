import {
  CARD_FACE,
  CARD_SCALE,
  HEADING_FONT,
  MASTER_PALETTE,
  UI_BUTTON,
  UI_PANELS,
  UI_SCALE,
} from '@pixel-packs/shared';

const P = MASTER_PALETTE;
const u = (n: number) => `${String(n * UI_SCALE)}px`;
const slice = (s: readonly number[]) => s.join(' ');
const sliceW = (s: readonly number[]) => s.map(u).join(' ');
const c = (n: number) => `calc(${String(n)}px * var(--card))`;
/** Absolute position of a CARD_FACE rect on a card drawn at --card scale. */
const rect = (r: { x: number; y: number; w: number; h: number }) =>
  `left: ${c(r.x)}; top: ${c(r.y)}; width: ${c(r.w)}; height: ${c(r.h)};`;

/** Style-tile CSS (GDD §16): palette tokens only, integer pixel scales, hard shadows. */
export function styleTileCss(): string {
  const { parchment, wood } = UI_PANELS;
  return `
@font-face { font-family: '${HEADING_FONT.family}'; src: url('${HEADING_FONT.file}') format('truetype'); font-display: block; }
:root {
  ${Object.entries(P)
    .map(([k, v]) => `--${k}: ${v};`)
    .join(' ')}
  --ui: ${String(UI_SCALE)}; --card: ${String(CARD_SCALE)};
  --display: 48px; --heading: 32px; --body: 18px; --small: 16px;
  --font-heading: '${HEADING_FONT.family}', monospace;
  --font-body: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
}
* { box-sizing: border-box; }
html { background: var(--barkDeep); }
body { margin: 0; padding: ${u(12)}; color: var(--ink); font: var(--body)/1.45 var(--font-body);
  cursor: url('/assets/icons/cursor.png') 2 2, auto; }
img, .px { image-rendering: pixelated; }
h1, h2, h3, .num { font-family: var(--font-heading); font-weight: normal; margin: 0; line-height: 1; }
h1 { font-size: var(--display); color: var(--glow); }
h2 { font-size: var(--heading); margin-bottom: ${u(6)}; }
.small { font-size: var(--small); color: var(--dusk); }
.tile { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${u(10)}; max-width: 1360px; margin: 0 auto; }
.tile > header { grid-column: 1 / -1; display: flex; align-items: baseline; gap: ${u(8)}; }
.tile > header p { color: var(--straw); margin: 0; }
.wide { grid-column: 1 / -1; }

.panel-parchment { border: solid transparent; border-image: url('${parchment.file}') ${slice(parchment.slice)} fill stretch;
  border-width: ${sliceW(parchment.slice)}; padding: ${u(2)} ${u(4)}; }
.panel-wood { border: solid transparent; border-image: url('${wood.file}') ${slice(wood.slice)} fill stretch;
  border-width: ${sliceW(wood.slice)}; padding: ${u(1)} ${u(2)}; color: var(--glow); }
.panel-wood h2 { color: var(--glow); }

.swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: ${u(2)}; }
.sw { font-size: 13px; line-height: 1.2; }
.sw i { display: block; height: ${u(14)}; border: ${u(1)} solid var(--ink); box-shadow: ${u(1)} ${u(1)} 0 var(--ink); margin-bottom: ${u(1)}; }
.strip { display: flex; margin: ${u(3)} 0 ${u(1)}; border: ${u(1)} solid var(--ink); }
.strip i { flex: 1; height: ${u(8)}; }

.types > * { margin: 0 0 ${u(3)}; }
.types .label { font: var(--small) var(--font-body); color: var(--dusk); display: block; }

.btn { font: var(--heading)/1 var(--font-heading); color: var(--glow); text-shadow: ${u(1)} ${u(1)} 0 var(--barkDeep);
  border: solid transparent; border-image: url('${UI_BUTTON.file('rest')}') ${slice(UI_BUTTON.slice)} fill stretch;
  border-width: ${sliceW(UI_BUTTON.slice)}; padding: 0 ${u(4)}; min-height: ${u(UI_BUTTON.h)}; background: none;
  cursor: inherit; position: relative; transition: transform 120ms cubic-bezier(.3,1.6,.5,1); }
.btn:hover { border-image-source: url('${UI_BUTTON.file('hover')}'); }
.btn:active, .btn.is-pressed { border-image-source: url('${UI_BUTTON.file('pressed')}'); transform: translateY(${u(1)}); }
.btn:disabled { border-image-source: url('${UI_BUTTON.file('disabled')}'); color: var(--mist); text-shadow: none; }
.btn:focus-visible { outline: ${u(1)} dashed var(--sunflower); outline-offset: ${u(2)}; }
.row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: ${u(6)}; }
.cap { display: block; text-align: center; font-size: var(--small); color: var(--dusk); margin-top: ${u(2)}; }

.icon { width: ${u(16)}; height: ${u(16)}; vertical-align: middle; }
.icon.x3 { width: 48px; height: 48px; }

.card { position: relative; width: calc(96px * var(--card)); height: calc(128px * var(--card)); flex: none; }
.card > * { position: absolute; }
.card .backdrop, .card .art { ${rect(CARD_FACE.art)} }
.card .backdrop { background: linear-gradient(var(--bd-sky) 78%, var(--bd-ground) 0); }
.card .art { overflow: hidden; }
.card .art img { width: 100%; height: 100%; }
.card .frame, .card .overlay { inset: 0; width: 100%; height: 100%; }
.variants { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${u(8)}; }
.variant h3 { margin-bottom: ${u(2)}; }
.card .name { ${rect(CARD_FACE.name)} padding: 0 ${c(3)};
  font: bold var(--name-size, 20px)/${c(CARD_FACE.name.h)} var(--font-body); text-align: center; white-space: nowrap; overflow: hidden; }
.card .rules { ${rect(CARD_FACE.rules)}
  font: 13px/1.25 var(--font-body); text-align: center; display: grid; place-content: center; }
.card .stat { display: grid; place-items: center;
  font: var(--heading)/${c(CARD_FACE.atk.h)} var(--font-heading); color: var(--ink); }

.home { display: grid; grid-template-columns: 1fr 1.3fr; gap: ${u(6)}; background: var(--mossDeep); padding: ${u(6)}; border: ${u(2)} solid var(--ink); box-shadow: ${u(3)} ${u(3)} 0 var(--ink); }
.home .topbar { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: ${u(6)}; }
.home nav { display: flex; gap: ${u(6)}; }
.home nav a { font: var(--heading)/1 var(--font-heading); color: var(--straw); text-decoration: none; display: flex; align-items: center; gap: ${u(2)}; }
.home nav a[aria-current] { color: var(--glow); text-decoration: underline ${u(1)} var(--sunflower); text-underline-offset: ${u(3)}; }
.badges { display: flex; gap: ${u(5)}; }
.badge { display: flex; align-items: center; gap: ${u(2)}; font: var(--heading)/1 var(--font-heading); color: var(--glow); }
.shelf { display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: ${u(2)}; border-bottom: ${u(4)} solid var(--bark); box-shadow: 0 ${u(2)} 0 var(--barkDeep); }
.pack img { width: calc(64px * var(--card)); height: calc(64px * var(--card)); }
.timer { display: flex; align-items: center; gap: ${u(3)}; margin: ${u(3)} 0 ${u(5)}; }
.timer .num { font-size: var(--heading); }
.pin { position: absolute; width: ${u(5)}; height: ${u(5)}; background: var(--berry); border: ${u(1)} solid var(--ink); }
`;
}
