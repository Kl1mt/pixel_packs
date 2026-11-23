import { readFile, writeFile } from 'node:fs/promises';
import { decodePng } from '../png.js';
import { fromRepo } from '../paths.js';
import { bbox } from '../compose/pixels.js';
import { styleTileHtml } from './html.js';

export const STYLE_TILE_PATH = 'apps/client/public/style-tile.html';
const CARDS = ['MOS-012', 'STA-003'];

/** Writes the static style tile (GDD §16 approval gate) to `apps/client/public/style-tile.html`. */
export async function buildStyleTile(packPicks: { mossgrove: number; starhollow: number }) {
  const artDrop: Record<string, number> = {};
  for (const id of CARDS) {
    const png = decodePng(await readFile(fromRepo(`apps/client/public/assets/cards/${id}.png`)));
    const b = bbox(png);
    artDrop[id] = b ? png.height - 1 - b.y1 : 0;
  }
  await writeFile(fromRepo(STYLE_TILE_PATH), styleTileHtml({ artDrop, packPicks }));
  return STYLE_TILE_PATH;
}
