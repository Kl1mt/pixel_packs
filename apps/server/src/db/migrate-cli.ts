import { loadConfig } from '../config.js';
import { createDb } from './client.js';
import { runMigrations } from './migrate.js';

const config = loadConfig();
const handle = createDb({ databaseUrl: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
try {
  await runMigrations(handle);
  console.log(`Migrations applied (${handle.kind}).`);
} finally {
  await handle.close();
}
