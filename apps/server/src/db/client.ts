import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type DbKind = 'pglite' | 'postgres';

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

export interface DbHandle {
  kind: DbKind;
  db: Db;
  close: () => Promise<void>;
}

export interface DbOptions {
  /** Postgres connection string. When absent, embedded PGlite is used. */
  databaseUrl?: string | undefined;
  /** PGlite data directory, or `memory://` for an in-memory database. */
  pgliteDir: string;
}

/**
 * Driver factory: PGlite (embedded Postgres) by default, node-postgres when a
 * `databaseUrl` is given. Both expose the same Drizzle query API.
 */
export function createDb(options: DbOptions): DbHandle {
  if (options.databaseUrl !== undefined) {
    const pool = new pg.Pool({ connectionString: options.databaseUrl });
    // Cast: the node-postgres and PGlite Drizzle databases share the PgDatabase
    // query surface; only the driver-specific result type differs.
    const db = drizzlePg(pool, { schema }) as unknown as Db;
    return { kind: 'postgres', db, close: () => pool.end() };
  }

  if (!options.pgliteDir.startsWith('memory://')) {
    mkdirSync(options.pgliteDir, { recursive: true });
  }
  const client = new PGlite(options.pgliteDir);
  const db = drizzlePglite(client, { schema });
  return { kind: 'pglite', db, close: () => client.close() };
}
