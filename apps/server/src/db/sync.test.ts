import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ENABLED_REALMS, buildPlaceholderCatalog } from '@pixel-packs/shared';
import { createDb, type DbHandle } from './client.js';
import { runMigrations } from './migrate.js';
import { cards, packTypes, seasons } from './schema.js';
import { syncCatalog, syncPackTypes } from './sync.js';

describe('startup sync', () => {
  let h: DbHandle;
  beforeAll(async () => {
    h = createDb({ pgliteDir: 'memory://' });
    await runMigrations(h);
  });
  afterAll(() => h.close());

  it('seeds Season 0', async () => {
    expect(await h.db.select().from(seasons)).toMatchObject([
      { id: 0, name: 'Season 0', endsAt: null },
    ]);
  });

  it('upserts the catalog and retires cards that left it', async () => {
    const catalog = buildPlaceholderCatalog(ENABLED_REALMS);
    await syncCatalog(h.db, catalog);
    expect(await h.db.select().from(cards)).toHaveLength(catalog.length);

    const [first, ...rest] = catalog;
    if (!first) throw new Error('empty placeholder catalog');
    await syncCatalog(h.db, [{ ...first, name: 'Renamed' }]);
    const [row] = await h.db.select().from(cards).where(eq(cards.id, first.id));
    expect(row).toMatchObject({ name: 'Renamed', retired: false });
    const retired = await h.db.select().from(cards).where(eq(cards.retired, true));
    expect(retired).toHaveLength(rest.length);

    await syncCatalog(h.db, catalog);
    expect(await h.db.select().from(cards).where(eq(cards.retired, true))).toHaveLength(0);
  });

  it('seeds pack types idempotently, enabling the M1 realms and the Mythic pack', async () => {
    await syncPackTypes(h.db);
    await syncPackTypes(h.db);
    const rows = await h.db.select().from(packTypes);
    expect(rows).toHaveLength(6);
    expect(
      rows
        .filter((r) => r.enabled)
        .map((r) => r.id)
        .sort(),
    ).toEqual(['mythic', 'realm:mossgrove', 'realm:starhollow']);
    expect(rows.every((r) => r.releaseSeason === 0)).toBe(true);
  });
});
