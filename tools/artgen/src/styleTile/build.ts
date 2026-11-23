import { writeFile } from 'node:fs/promises';
import { CARD_ART_DROP } from '@pixel-packs/shared';
import { fromRepo } from '../paths.js';
import { styleTileHtml } from './html.js';

export const STYLE_TILE_PATH = 'apps/client/public/style-tile.html';

/** Writes the static style tile (GDD §16 approval gate) to `apps/client/public/style-tile.html`. */
export async function buildStyleTile(packPicks: { mossgrove: number; starhollow: number }) {
  await writeFile(
    fromRepo(STYLE_TILE_PATH),
    styleTileHtml({ artDrop: { ...CARD_ART_DROP }, packPicks }),
  );
  return STYLE_TILE_PATH;
}
