import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** tools/artgen */
export const ARTGEN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(ARTGEN_DIR, '..', '..');
export const MANIFEST_PATH = resolve(ARTGEN_DIR, 'manifest.json');
export const SPECS_DIR = resolve(ARTGEN_DIR, 'specs');

/** Paths in specs and the manifest are repo-relative with forward slashes. */
export function fromRepo(path: string): string {
  return resolve(REPO_ROOT, path);
}

export function toRepo(absPath: string): string {
  return relative(REPO_ROOT, absPath).split('\\').join('/');
}
