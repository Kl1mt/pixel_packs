import { z } from 'zod';

const BoolSchema = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v === 'true' || v === '1'));

/** Optional string: blank or missing means "not set". */
const OptionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().min(1).default('127.0.0.1'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // Empty string means "not set" so a blank line in .env falls back to PGlite.
    DATABASE_URL: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v.trim() === '' ? undefined : v)),
    PGLITE_DIR: z.string().min(1).default('.data/pglite'),
    /** Public origin of the client, used for links in emails. */
    APP_ORIGIN: z.url().default('http://localhost:5173'),
    /** Secure cookies; defaults to on in production only (dev runs on plain http). */
    COOKIE_SECURE: BoolSchema,
    /** Per-route rate limits (GDD §22); E2E runs switch them off. Always on in production. */
    RATE_LIMIT: BoolSchema,
    /** Discord OAuth (T09, README). Login with Discord is hidden unless both are set. */
    DISCORD_CLIENT_ID: OptionalString,
    DISCORD_CLIENT_SECRET: OptionalString,
    /** Defaults to `${APP_ORIGIN}/api/auth/discord/callback` (through the Vite proxy in dev). */
    DISCORD_REDIRECT_URI: OptionalString.pipe(z.url().optional()),
  })
  .transform(
    ({
      COOKIE_SECURE,
      RATE_LIMIT,
      DISCORD_CLIENT_ID,
      DISCORD_CLIENT_SECRET,
      DISCORD_REDIRECT_URI,
      ...env
    }) => ({
      ...env,
      COOKIE_SECURE: COOKIE_SECURE ?? env.NODE_ENV === 'production',
      RATE_LIMIT: env.NODE_ENV === 'production' || RATE_LIMIT !== false,
      discord:
        DISCORD_CLIENT_ID !== undefined && DISCORD_CLIENT_SECRET !== undefined
          ? {
              clientId: DISCORD_CLIENT_ID,
              clientSecret: DISCORD_CLIENT_SECRET,
              redirectUri:
                DISCORD_REDIRECT_URI ??
                `${env.APP_ORIGIN.replace(/\/$/, '')}/api/auth/discord/callback`,
            }
          : null,
    }),
  );

export type Config = z.infer<typeof EnvSchema>;

/** Parses process environment into a typed config. Throws on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return EnvSchema.parse(env);
}
