import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import {
  HealthResponseSchema,
  createCryptoRng,
  type CatalogIndex,
  type HealthResponse,
  type Rng,
} from '@pixel-packs/shared';
import { SERVER_CATALOG_INDEX } from './catalog.js';
import { registerDevRoutes } from './dev/routes.js';
import { registerEconomyRoutes } from './economy/routes.js';
import { registerOnboardingRoutes } from './onboarding/routes.js';
import type { DbHandle } from './db/client.js';
import type { Mailer } from './mail/mailer.js';
import { registerErrorHandler } from './http/errors.js';
import { registerAuthHooks } from './auth/plugin.js';
import { registerAuthRoutes } from './auth/routes.js';
import { createAuthService } from './auth/service.js';
import type { DiscordClient } from './auth/discord.js';
import { registerDiscordRoutes } from './auth/discordRoutes.js';
import { createOAuthService } from './auth/oauth.js';

export interface AppDeps {
  db: DbHandle;
  mailer: Mailer;
  appOrigin: string;
  cookieSecure: boolean;
  /** Discord OAuth client, or null/absent when no credentials are configured. */
  discord?: DiscordClient | null;
  /** Per-route rate limits; tests switch them off except where they test them. */
  rateLimit?: boolean;
  now?: () => Date;
  /** Pack RNG; defaults to the crypto RNG. Tests inject a seeded one. */
  rng?: Rng;
  catalogIndex?: CatalogIndex;
  /** Honour `tools/admin` odds overrides; must be false in production. */
  allowDevOverrides?: boolean;
}

/** Builds the Fastify app without listening, so tests can use `app.inject`. */
export async function buildApp(
  deps: AppDeps,
  options: FastifyServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify(options);
  const cookies = { secure: deps.cookieSecure };
  const auth = createAuthService(deps.db.db, deps.now);

  registerErrorHandler(app);
  await app.register(cookie);
  // Without the plugin, the routes' `config.rateLimit` is simply ignored.
  if (deps.rateLimit !== false) await app.register(rateLimit, { global: false });
  registerAuthHooks(app, auth, cookies);

  app.get('/api/health', (): HealthResponse => {
    return HealthResponseSchema.parse({
      status: 'ok',
      service: 'pixel-packs-server',
      db: deps.db.kind,
      time: new Date().toISOString(),
    });
  });

  registerAuthRoutes(app, { auth, mailer: deps.mailer, cookies, appOrigin: deps.appOrigin });
  registerDiscordRoutes(app, {
    auth,
    oauth: createOAuthService(deps.db.db, deps.now),
    discord: deps.discord ?? null,
    mailer: deps.mailer,
    cookies,
    appOrigin: deps.appOrigin,
  });
  const economy = {
    db: deps.db.db,
    now: deps.now ?? (() => new Date()),
    rng: deps.rng ?? createCryptoRng(),
    index: deps.catalogIndex ?? SERVER_CATALOG_INDEX,
    allowDevOverrides: deps.allowDevOverrides ?? false,
  };
  registerEconomyRoutes(app, economy);
  registerOnboardingRoutes(app, economy);
  // `/api/dev/*` (forcing results from `/debug`) exists only where overrides are honoured.
  if (economy.allowDevOverrides) registerDevRoutes(app, economy);

  return app;
}
