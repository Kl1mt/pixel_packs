import {
  CARD_CATALOG,
  CARD_FACE,
  FRAME_MATERIALS,
  ICONS,
  MASTER_PALETTE,
  RARITIES,
  REALM_PALETTES,
  cardRulesText,
  iconFile,
  realmPaletteHex,
  statDigitPixels,
  type Rarity,
  type Realm,
} from '@pixel-packs/shared';
import { styleTileCss } from './css.js';

/** Inputs the generator can't read from shared config. */
export interface StyleTileInput {
  /** Rows to shift card art down so its feet sit on the window's bottom row. */
  artDrop: Record<string, number>;
  /** Candidate numbers shown as the current pack picks. */
  packPicks: { mossgrove: number; starhollow: number };
}

interface CardOptions {
  rarity?: Rarity;
  atk?: number;
  hp?: number;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BACKDROP: Partial<Record<Realm, [string, string]>> = {
  mossgrove: [MASTER_PALETTE.lichen, MASTER_PALETTE.sprout],
  starhollow: [MASTER_PALETTE.indigo, MASTER_PALETTE.night],
};

const icon = (name: (typeof ICONS)[number], cls = 'icon') =>
  `<img class="${cls}" src="${iconFile(name)}" alt="" width="16" height="16">`;

/**
 * Card-name size in screen px at 3×: 20 px for most names, smaller for long ones
 * so even "Umbra, the Dreaming Bear" keeps a margin inside the banner (checked
 * for the whole catalog in styleTile.test.ts).
 */
export function nameSize(name: string): number {
  return name.length <= 15 ? 20 : name.length <= 19 ? 18 : 16;
}

function card(id: string, opts: CardOptions, input: StyleTileInput): string {
  const c = CARD_CATALOG.find((x) => x.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  const r = opts.rarity ?? c.rarity;
  const atk = opts.atk ?? c.atk;
  const hp = opts.hp ?? c.hp;
  const [sky, ground] = BACKDROP[c.realm] ?? [MASTER_PALETTE.cream, MASTER_PALETTE.straw];
  const drop = input.artDrop[id] ?? 0;
  const s = (n: number) => `calc(${String(n)}px * var(--card))`;
  const rules = cardRulesText(c);
  // ATK/HP: chunky ink digits in art pixels, centred in the badge circles (shared statDigitPixels).
  const stats = [...statDigitPixels(atk, CARD_FACE.atk), ...statDigitPixels(hp, CARD_FACE.hp)];
  return `<figure class="card" style="--bd-sky:${sky};--bd-ground:${ground}" aria-label="${esc(c.name)}, ${r}, attack ${String(atk)}, health ${String(hp)}">
  <div class="backdrop"></div>
  <div class="art"><img src="/assets/cards/${id}.png" alt="" style="transform:translateY(${s(drop)})"></div>
  <img class="frame" src="/assets/frames/${r}.png" alt="">
  <div class="name" style="--name-size:${String(nameSize(c.name))}px">${esc(c.name)}</div>
  <div class="rules">${rules.map((l) => `<span>${esc(l)}</span>`).join('')}</div>
  ${pixelsSvg(stats, MASTER_PALETTE.ink)}
</figure>`;
}

/** Crisp SVG of one-colour pixels over a 96×128 card at the card's CSS scale. */
export function pixelsSvg(pixels: { x: number; y: number }[], colour: string): string {
  const rects = pixels.map(
    (p) => `<rect x="${String(p.x)}" y="${String(p.y)}" width="1" height="1"/>`,
  );
  return `<svg class="overlay" viewBox="0 0 ${String(CARD_FACE.size.w)} ${String(CARD_FACE.size.h)}" fill="${colour}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}

function palette(): string {
  const sw = Object.entries(MASTER_PALETTE)
    .map(
      ([k, v]) =>
        `<div class="sw"><i style="background:${v}"></i>${k}<br><span class="small">${v}</span></div>`,
    )
    .join('');
  const strip = (realm: Realm) =>
    `<p class="small">${esc(REALM_PALETTES[realm]?.name ?? realm)}</p><div class="strip">${realmPaletteHex(
      realm,
    )
      .map((h) => `<i style="background:${h}"></i>`)
      .join('')}</div>`;
  return `<section class="panel-parchment wide"><h2>Palette</h2><div class="swatches">${sw}</div>${strip('mossgrove')}${strip('starhollow')}</section>`;
}

function typeScale(): string {
  return `<section class="panel-parchment types"><h2>Type</h2>
  <p><span class="label">Display · Pixel Packs Hollow 48 px (3× its 16 px glyph)</span><span class="num" style="font-size:var(--display)">Wandering Post 1240</span></p>
  <p><span class="label">Heading &amp; numbers · 32 px (2×)</span><span class="num" style="font-size:var(--heading)">Open your satchel · 02:14:09</span></p>
  <p><span class="label">Body · storybook serif 18 px</span>A moth courier lands on your windowsill with a satchel of cards, still warm from the road.</p>
  <p><span class="label">Small · 16 px</span><span style="font-size:var(--small)">Odds are shown on every pack. Scripted onboarding packs never count towards pity.</span></p>
</section>`;
}

function uiParts(): string {
  const icons = ICONS.map(
    (n) => `<span>${icon(n, 'icon x3')}<span class="cap">${n}</span></span>`,
  ).join('');
  return `<section class="panel-wood"><h2>Panels, buttons &amp; icons</h2>
  <div class="row">
    <button class="btn">Open</button>
    <button class="btn" style="border-image-source:url('/assets/ui/button-hover.png')">Hover</button>
    <button class="btn is-pressed">Pressed</button>
    <button class="btn" disabled>Locked</button>
  </div>
  <p class="small" style="color:var(--straw)">Rest · hover · pressed (moves down 2 px, edge shrinks) · disabled. Hover the first one; keyboard focus shows a dashed sunflower ring.</p>
  <div class="panel-parchment" style="color:var(--ink)"><h3 class="num" style="font-size:var(--heading)">Parchment</h3>A 9-slice panel at 2×; it stretches to any size and its corners stay crisp.</div>
  <div class="row" style="margin-top:8px">${icons}</div>
</section>`;
}

function cards(input: StyleTileInput): string {
  const frames = RARITIES.map(
    (r) =>
      `<span><img class="px" src="/assets/frames/${r}.png" alt="${r} frame" width="192" height="256"><span class="cap">${r} · ${FRAME_MATERIALS[r].name}</span></span>`,
  ).join('');
  return `<section class="panel-parchment wide"><h2>Cards</h2>
  <div class="row">${card('MOS-012', {}, input)}${card('STA-003', {}, input)}
  <span><img class="px" src="/assets/frames/back.png" alt="card back" width="288" height="384"><span class="cap">card back</span></span></div>
  <p class="small">Cards at 3×. Rarity shows as frame material plus 1–6 pips, never by colour alone. The art is bottom-aligned on the window's bottom row.</p>
  <div class="row">${frames}</div>
</section>`;
}

function home(input: StyleTileInput): string {
  const packs = (['mossgrove', 'starhollow'] as const)
    .map(
      (r) =>
        `<figure class="pack" style="margin:0"><img src="/assets/packs/${r}.png" alt="${r} pack"><span class="cap" style="color:var(--glow)">${r === 'mossgrove' ? 'Mossgrove' : 'Starhollow'} · ${icon('gold')} 100</span></figure>`,
    )
    .join('');
  return `<section class="wide"><h2 style="color:var(--glow)">Home (fragment)</h2>
<div class="home">
  <div class="topbar panel-wood">
    <nav aria-label="Main"><a href="#" aria-current="page">${icon('nav-home')}Home</a><a href="#">${icon('nav-packs')}Packs</a><a href="#">${icon('nav-binder')}Binder</a></nav>
    <div class="badges"><span class="badge">${icon('gold')}1240</span><span class="badge">${icon('gem')}35</span><span class="badge">${icon('stardust')}180</span></div>
  </div>
  <div class="panel-parchment" style="position:relative">
    <span class="pin" style="left:8px;top:-4px"></span>
    <h2>Free pack</h2>
    <div class="timer">${icon('timer', 'icon x3')}<span class="num">02:14:09</span></div>
    <p>Your next satchel is on its way. One is waiting for you now.</p>
    <button class="btn">Open packs</button>
  </div>
  <div class="panel-wood"><h2>Pack shelf</h2><div class="shelf">${packs}</div>
  <p class="small" style="color:var(--straw)">Pack art candidates: Mossgrove #${String(input.packPicks.mossgrove)}, Starhollow #${String(input.packPicks.starhollow)}.</p></div>
</div></section>`;
}

export function styleTileHtml(input: StyleTileInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pixel Packs · style tile (T06)</title>
<!-- Generated by \`pnpm --filter @pixel-packs/artgen start style-tile\`; do not edit by hand. -->
<style>${styleTileCss()}</style>
</head>
<body>
<main class="tile">
  <header><h1>Pixel Packs · style tile</h1><p>T06: palette, type, panels, buttons, one card, home fragment</p></header>
  ${palette()}
  ${typeScale()}
  ${uiParts()}
  ${cards(input)}
  ${home(input)}
</main>
</body>
</html>
`;
}
