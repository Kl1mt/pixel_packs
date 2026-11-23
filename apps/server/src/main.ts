import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';

const config = loadConfig();
const db = createDb({ databaseUrl: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
await runMigrations(db);

const app = buildApp({ dbKind: db.kind }, { logger: { level: config.LOG_LEVEL } });
app.addHook('onClose', async () => {
  await db.close();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
