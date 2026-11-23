import { fileURLToPath } from 'node:url';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { DbHandle } from './client.js';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Applies all pending Drizzle migrations from `apps/server/drizzle`. */
export async function runMigrations(handle: DbHandle): Promise<void> {
  const config = { migrationsFolder: MIGRATIONS_DIR };
  if (handle.kind === 'postgres') {
    // See client.ts: the handle's db was created by drizzle-orm/node-postgres.
    await migratePg(handle.db as unknown as NodePgDatabase, config);
  } else {
    await migratePglite(handle.db, config);
  }
}
