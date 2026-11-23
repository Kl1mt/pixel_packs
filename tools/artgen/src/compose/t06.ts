import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PNG } from 'pngjs';
import { RARITIES } from '@pixel-packs/shared';
import { decodePng, encodePng } from '../png.js';
import { fromRepo } from '../paths.js';
import { allFrames } from './frames.js';
import { reduceIcon } from './icons.js';
import { cropToMainBody } from './pixels.js';

/**
 * Composes T06's final assets from the generated candidates (see the manifest,
 * spec `t06`) into `apps/client/public/assets/`. Deterministic: rerunning it
 * gives the same files. Pack picks are the candidates chosen on the style tile.
 */
const CAND = 'tools/artgen/candidates/t06';
const OUT = 'apps/client/public/assets';

/** Pack candidates picked on the style tile (1-based, see the candidates' sheet.png). */
export const T06_PACK_NUMBERS = { mossgrove: 5, starhollow: 6 };
const pick = (n: number) => String(n).padStart(2, '0');

export const T06_PICKS = {
  frameBase: `${CAND}/frame-base/01.png`,
  cardBack: `${CAND}/card-back/01.png`,
  packs: {
    mossgrove: `${CAND}/pack-mossgrove/${pick(T06_PACK_NUMBERS.mossgrove)}.png`,
    starhollow: `${CAND}/pack-starhollow/${pick(T06_PACK_NUMBERS.starhollow)}.png`,
  },
  panels: {
    parchment: `${CAND}/ui-pieces/elements/01-parchment-panel.png`,
    wood: `${CAND}/ui-pieces/elements/02-wood-panel.png`,
  },
  button: {
    rest: `${CAND}/ui-pieces/elements/03-button.png`,
    hover: `${CAND}/button-states/01.png`,
    pressed: `${CAND}/button-states/02.png`,
    disabled: `${CAND}/button-states/03.png`,
  },
  icons: ['gold', 'gem', 'stardust', 'timer', 'nav-home', 'nav-packs', 'nav-binder', 'cursor'],
  font: `${CAND}/font-heading/font.ttf`,
} as const;

const read = async (path: string): Promise<PNG> => decodePng(await readFile(fromRepo(path)));

async function write(path: string, png: PNG, log: (m: string) => void): Promise<void> {
  const abs = fromRepo(path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, encodePng(png));
  log(`  ${path} (${String(png.width)}×${String(png.height)})`);
}

export async function composeT06(log: (m: string) => void): Promise<void> {
  const p = T06_PICKS;
  const frames = allFrames(await read(p.frameBase));
  for (const r of RARITIES) await write(`${OUT}/frames/${r}.png`, frames[r], log);
  await write(`${OUT}/frames/back.png`, await read(p.cardBack), log);

  for (const [realm, file] of Object.entries(p.packs)) {
    await write(`${OUT}/packs/${realm}.png`, await read(file), log);
  }
  for (const [name, file] of Object.entries(p.panels)) {
    await write(`${OUT}/ui/panel-${name}.png`, cropToMainBody(await read(file)), log);
  }
  for (const [state, file] of Object.entries(p.button)) {
    await write(`${OUT}/ui/button-${state}.png`, cropToMainBody(await read(file)), log);
  }
  for (const icon of p.icons) {
    await write(
      `${OUT}/icons/${icon}.png`,
      reduceIcon(await read(`${CAND}/icon-${icon}/01.png`)),
      log,
    );
  }
  const font = fromRepo(`${OUT}/fonts/pixel-packs-hollow.ttf`);
  await mkdir(dirname(font), { recursive: true });
  await copyFile(fromRepo(p.font), font);
  log(`  ${OUT}/fonts/pixel-packs-hollow.ttf`);
}
