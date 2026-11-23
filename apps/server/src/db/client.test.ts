import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb } from './client.js';
import { runMigrations } from './migrate.js';

describe('createDb', () => {
  it('defaults to PGlite, runs migrations and answers queries', async () => {
    const handle = createDb({ pgliteDir: 'memory://' });
    try {
      expect(handle.kind).toBe('pglite');
      await runMigrations(handle);
      const result = await handle.db.execute<{ one: number }>(sql`select 1 as one`);
      expect(result.rows[0]?.one).toBe(1);
    } finally {
      await handle.close();
    }
  });

  it('picks node-postgres when a DATABASE_URL is given', async () => {
    const handle = createDb({
      databaseUrl: 'postgres://user:pass@127.0.0.1:1/none',
      pgliteDir: 'memory://',
    });
    expect(handle.kind).toBe('postgres');
    await handle.close();
  });
});
