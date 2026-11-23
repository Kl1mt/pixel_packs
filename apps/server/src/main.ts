import { buildApp } from './app.js';
import { createDiscordClient } from './auth/discord.js';
import { SERVER_CATALOG } from './catalog.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { syncCatalog, syncPackTypes } from './db/sync.js';
import { createConsoleMailer } from './mail/mailer.js';

const config = loadConfig();
const db = createDb({ databaseUrl: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
await runMigrations(db);
await syncCatalog(db.db, SERVER_CATALOG);
await syncPackTypes(db.db);

const app = await buildApp(
  {
    db,
    mailer: createConsoleMailer(),
    appOrigin: config.APP_ORIGIN,
    cookieSecure: config.COOKIE_SECURE,
    rateLimit: config.RATE_LIMIT,
    discord: config.discord ? createDiscordClient(config.discord) : null,
    allowDevOverrides: config.NODE_ENV !== 'production',
  },
  { logger: { level: config.LOG_LEVEL } },
);
app.addHook('onClose', async () => {
  await db.close();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
app.log.info(
  config.discord ? 'Discord login enabled' : 'Discord login hidden (no DISCORD_CLIENT_ID/SECRET)',
);
