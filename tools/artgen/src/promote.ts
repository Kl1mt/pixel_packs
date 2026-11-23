import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { findEntry, type Manifest } from './manifest.js';
import { fromRepo } from './paths.js';
import { decodePng, encodePng } from './png.js';
import { recentreOffsetX, translate } from './shift.js';

/**
 * Copies an approved candidate to its final repo path. Approved files are immutable
 * (GDD §19), so an existing destination is never overwritten. With `recentre`, the
 * sprite is moved horizontally by whole pixels so its opaque bbox is centred (no
 * resampling). Returns the applied horizontal shift.
 */
export async function promote(
  manifest: Manifest,
  entryId: string,
  index: number,
  dest: string,
  opts: { recentre?: boolean } = {},
): Promise<number> {
  const output = findEntry(manifest, entryId)?.outputs.find((o) => o.index === index);
  if (!output) throw new Error(`no candidate ${entryId} #${String(index)}`);
  if (output.review !== 'approved') throw new Error(`${entryId} #${String(index)} is not approved`);
  await mkdir(dirname(fromRepo(dest)), { recursive: true });
  try {
    if (!opts.recentre) {
      await copyFile(fromRepo(output.file), fromRepo(dest), 1 /* COPYFILE_EXCL */);
      return 0;
    }
    const png = decodePng(await readFile(fromRepo(output.file)));
    const dx = recentreOffsetX(png);
    await writeFile(fromRepo(dest), encodePng(translate(png, dx, 0)), { flag: 'wx' });
    return dx;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`${dest} exists; approved files are immutable, use a new filename`, {
        cause: e,
      });
    }
    throw e;
  }
}
