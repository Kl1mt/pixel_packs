import { readFile, writeFile } from 'node:fs/promises';
import { decodePng } from '../png.js';
import { fromRepo } from '../paths.js';
import { bbox } from '../compose/pixels.js';
import { CARD_FACE, MASTER_PALETTE, type Rarity } from '@pixel-packs/shared';
import { get, rgbaToHex } from '../compose/pixels.js';
import { styleTileHtml } from './html.js';

/** The cream/glow interior pixels of a frame's ATK and HP circles. */
async function lightBadgePixels(rarity: Rarity) {
  const frame = decodePng(
    await readFile(fromRepo(`apps/client/public/assets/frames/${rarity}.png`)),
  );
  const light = new Set<string>([MASTER_PALETTE.cream, MASTER_PALETTE.glow]);
  const pick = (r: { x: number; y: number; w: number; h: number }) => {
    const out: { x: number; y: number }[] = [];
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        if (light.has(rgbaToHex(get(frame, x, y)))) out.push({ x, y });
    return out;
  };
  return { atk: pick(CARD_FACE.atk), hp: pick(CARD_FACE.hp) };
}

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
  const badgeMask = await lightBadgePixels('legendary');
  await writeFile(fromRepo(STYLE_TILE_PATH), styleTileHtml({ artDrop, packPicks, badgeMask }));
  return STYLE_TILE_PATH;
}
