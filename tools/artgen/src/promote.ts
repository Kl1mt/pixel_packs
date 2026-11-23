import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { findEntry, type Manifest } from './manifest.js';
import { fromRepo } from './paths.js';

/**
 * Copies an approved candidate to its final repo path. Approved files are immutable
 * (GDD §19), so an existing destination is never overwritten.
 */
export async function promote(
  manifest: Manifest,
  entryId: string,
  index: number,
  dest: string,
): Promise<void> {
  const output = findEntry(manifest, entryId)?.outputs.find((o) => o.index === index);
  if (!output) throw new Error(`no candidate ${entryId} #${String(index)}`);
  if (output.review !== 'approved') throw new Error(`${entryId} #${String(index)} is not approved`);
  await mkdir(dirname(fromRepo(dest)), { recursive: true });
  try {
    await copyFile(fromRepo(output.file), fromRepo(dest), 1 /* COPYFILE_EXCL */);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`${dest} exists; approved files are immutable, use a new filename`, {
        cause: e,
      });
    }
    throw e;
  }
}
