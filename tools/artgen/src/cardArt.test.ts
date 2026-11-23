import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, ENABLED_REALMS } from '@pixel-packs/shared';
import { readManifest } from './manifest.js';
import { fromRepo } from './paths.js';
import { decodePng, imageStats } from './png.js';
import { sameUpToTranslation } from './shift.js';

/**
 * Catalog art test (T05): every card of an enabled realm ships a 64×64 sprite that is an
 * approved manifest candidate, unchanged or moved by whole pixels (`promote --recentre`).
 */
describe('card art', async () => {
  const manifest = await readManifest();
  const approved = await Promise.all(
    manifest.entries
      .flatMap((e) => e.outputs.filter((o) => o.review === 'approved'))
      .map(async (o) => decodePng(await readFile(fromRepo(o.file)))),
  );
  const cards = CARD_CATALOG.filter((c) => ENABLED_REALMS.includes(c.realm));

  it('covers every card of the enabled realms', () => {
    expect(cards.length).toBe(26);
  });

  it.each(cards.map((c) => c.id))('%s is an approved, uncropped 64×64 sprite', async (id) => {
    const png = decodePng(await readFile(fromRepo(`apps/client/public/assets/cards/${id}.png`)));
    expect(png).toMatchObject({ width: 64, height: 64 });
    expect(imageStats(png).touchesEdge).toBe(false);
    expect(approved.some((a) => sameUpToTranslation(a, png))).toBe(true);
  });
});
