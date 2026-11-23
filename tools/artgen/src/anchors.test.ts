import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ENABLED_REALMS } from '@pixel-packs/shared';
import { loadAnchors } from './anchors.js';
import { readManifest } from './manifest.js';
import { fromRepo } from './paths.js';
import { decodePng } from './png.js';

describe('approved style anchors', async () => {
  const anchors = await loadAnchors();
  const manifest = await readManifest();
  const approved = manifest.entries.flatMap((e) =>
    e.outputs.filter((o) => o.review === 'approved'),
  );
  const approvedBytes = await Promise.all(approved.map((o) => readFile(fromRepo(o.file))));

  it('covers every enabled realm', () => {
    for (const realm of ENABLED_REALMS) expect(anchors.realms[realm]?.palette).toBe(realm);
  });

  it('uses 64×64 images that are byte-identical to approved manifest candidates', async () => {
    for (const realm of ENABLED_REALMS) {
      for (const path of anchors.realms[realm]?.styleImages ?? []) {
        const buf = await readFile(fromRepo(path));
        expect(decodePng(buf)).toMatchObject({ width: 64, height: 64 });
        expect(
          approvedBytes.some((b) => b.equals(buf)),
          path,
        ).toBe(true);
      }
    }
  });
});
