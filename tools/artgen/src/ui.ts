import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PixelLabClient } from './api/client.js';
import { SplitResponseSchema, UiAssetDetailSchema } from './api/schemas.js';
import { findEntry, writeManifest, type Manifest } from './manifest.js';
import { fromRepo, toRepo } from './paths.js';

export function slug(name: string | null | undefined, n: number): string {
  const base = (name ?? 'element')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${String(n).padStart(2, '0')}-${base || 'element'}`;
}

/**
 * Splits a `create-ui-asset` template into one asset per shape (free on PixelLab),
 * downloads each element PNG next to the template and records the elements
 * (id, name, 9-slice insets, file) in the template's manifest entry.
 */
export async function uiSplit(
  client: PixelLabClient,
  manifest: Manifest,
  entryId: string,
  log: (msg: string) => void,
  manifestPath?: string,
): Promise<void> {
  const entry = findEntry(manifest, entryId);
  const assetId = entry?.extra?.uiAssetId;
  if (!entry || typeof assetId !== 'string') throw new Error(`${entryId} is not a UI template`);
  const template = entry.outputs[0];
  if (!template) throw new Error(`${entryId} has no template image`);

  let detail = await client.get(`/ui-assets/${assetId}`, UiAssetDetailSchema);
  if (detail.elements.length === 0) {
    log(`splitting ${assetId} (${String(detail.split_preview.length)} default boxes)…`);
    await client.post(`/ui-assets/${assetId}/split`, SplitResponseSchema, {});
    detail = await client.get(`/ui-assets/${assetId}`, UiAssetDetailSchema);
  }

  const dir = join(dirname(fromRepo(template.file)), 'elements');
  await mkdir(dir, { recursive: true });
  const elements = [];
  for (const [i, el] of detail.elements.entries()) {
    if (!el.image_url) continue;
    const file = join(dir, `${slug(el.name, i + 1)}.png`);
    await writeFile(file, await client.download(el.image_url));
    elements.push({
      id: el.id,
      name: el.name ?? null,
      nineSlice: el.nine_slice ?? null,
      file: toRepo(file),
    });
    log(`  ${toRepo(file)} (${el.id})`);
  }
  entry.extra = { ...entry.extra, elements };
  await writeManifest(manifest, manifestPath);
}
