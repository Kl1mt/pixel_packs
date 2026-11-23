import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PNG } from 'pngjs';
import { findEntry, type Manifest } from '../manifest.js';
import { fromRepo } from '../paths.js';
import { decodePng } from '../png.js';
import { boardPreview, type BoardCell } from './preview.js';
import type { CharacterSpec } from './spec.js';
import { cardArtPath } from './run.js';

async function framesOf(manifest: Manifest, id: string): Promise<PNG[]> {
  const entry = findEntry(manifest, id);
  if (entry?.status !== 'completed') return [];
  const files = entry.outputs.map((o) => o.file).filter((f) => /\/\d\d\.png$/.test(f));
  return Promise.all(files.map(async (f) => decodePng(await readFile(fromRepo(f)))));
}

/**
 * Writes an animated side-by-side board: one row per character (card art, south and
 * east rotations, then its animations in spec order). Returns the column labels.
 */
export async function writeCharacterBoard(
  spec: CharacterSpec,
  manifest: Manifest,
  outPath: string,
  tickMs = 150,
): Promise<string[]> {
  const rows: (BoardCell | null)[][] = [];
  const labels = ['card', 'south', 'east'];
  for (const a of spec.animations) {
    const label = `${a.name} ${a.direction}`;
    if (!labels.includes(label)) labels.push(label);
  }
  for (const c of spec.characters) {
    const card = decodePng(await readFile(fromRepo(cardArtPath(c.cardId))));
    const entry = findEntry(manifest, `${spec.id}/${c.id}`);
    const rot = async (dir: string): Promise<BoardCell | null> => {
      const file = entry?.outputs.find((o) => o.file.endsWith(`/${dir}.png`))?.file;
      return file ? { frames: [decodePng(await readFile(fromRepo(file)))] } : null;
    };
    const row: (BoardCell | null)[] = [{ frames: [card] }, await rot('south'), await rot('east')];
    for (const label of labels.slice(3)) {
      const a = spec.animations.find(
        (x) => x.character === c.id && `${x.name} ${x.direction}` === label,
      );
      const frames = a ? await framesOf(manifest, `${spec.id}/${a.id}`) : [];
      row.push(frames.length > 0 ? { frames } : null);
    }
    rows.push(row);
  }
  await mkdir(dirname(fromRepo(outPath)), { recursive: true });
  await writeFile(fromRepo(outPath), boardPreview(rows, tickMs));
  return labels;
}
