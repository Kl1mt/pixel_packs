import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { CSRF_HEADER, type Rng } from '@pixel-packs/shared';
import { buildApp } from '../app.js';
import { createDb, type DbHandle } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { syncCatalog, syncPackTypes } from '../db/sync.js';
import { SERVER_CATALOG } from '../catalog.js';
import { createMemoryMailer, type MailMessage } from '../mail/mailer.js';

export interface TestApp {
  app: FastifyInstance;
  db: DbHandle;
  mail: MailMessage[];
  close: () => Promise<void>;
}

/** A fresh in-memory PGlite database with migrations, plus the app on top. */
export async function createTestApp(
  opts: { rateLimit?: boolean; now?: () => Date; rng?: Rng; databaseUrl?: string } = {},
): Promise<TestApp> {
  const db = createDb({ pgliteDir: 'memory://', databaseUrl: opts.databaseUrl });
  await runMigrations(db);
  await syncCatalog(db.db, SERVER_CATALOG);
  await syncPackTypes(db.db);
  const mailer = createMemoryMailer();
  const app = await buildApp({
    db,
    mailer,
    appOrigin: 'http://app.test',
    cookieSecure: false,
    rateLimit: opts.rateLimit ?? false,
    allowDevOverrides: true,
    ...(opts.now ? { now: opts.now } : {}),
    ...(opts.rng ? { rng: opts.rng } : {}),
  });
  return {
    app,
    db,
    mail: mailer.sent,
    close: async () => {
      await app.close();
      await db.close();
    },
  };
}

/** A tiny cookie jar client: keeps cookies and sends the CSRF header on mutations. */
export class Client {
  readonly cookies = new Map<string, string>();
  constructor(private readonly app: FastifyInstance) {}

  async csrf(): Promise<string> {
    const res = await this.request({ method: 'GET', url: '/api/auth/csrf' });
    return res.json<{ csrfToken: string }>().csrfToken;
  }

  async request(opts: InjectOptions & { csrf?: boolean }): Promise<LightMyRequestResponse> {
    const { csrf = true, ...rest } = opts;
    const headers: Record<string, string> = {};
    const jar = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (jar) headers.cookie = jar;
    const csrfToken = this.cookies.get('pp_csrf');
    if (csrf && csrfToken !== undefined) headers[CSRF_HEADER] = csrfToken;
    const res = await this.app.inject({
      ...rest,
      headers: { ...headers, ...(rest.headers ?? {}) },
    });
    for (const c of res.cookies) {
      const expired =
        c.maxAge === 0 || (c.expires !== undefined && c.expires.getTime() <= Date.now());
      if (expired || c.value === '') this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
    return res;
  }

  post(url: string, payload?: object): Promise<LightMyRequestResponse> {
    return this.request({ method: 'POST', url, ...(payload ? { payload } : {}) });
  }

  get(url: string): Promise<LightMyRequestResponse> {
    return this.request({ method: 'GET', url });
  }
}

export function tokenFromMail(mail: MailMessage | undefined): string {
  const match = mail?.text.match(/token=([A-Za-z0-9_-]{43})/);
  if (!match?.[1]) throw new Error('no token in mail');
  return match[1];
}

let playerCounter = 0;

/** Registers a fresh player and returns the logged-in client and the user id. */
export async function newPlayer(app: FastifyInstance): Promise<{ c: Client; userId: string }> {
  playerCounter += 1;
  const tag = `${Date.now().toString(36)}${playerCounter}`;
  const c = new Client(app);
  await c.csrf();
  const res = await c.post('/api/auth/register', {
    email: `p${tag}@example.com`,
    username: `p_${tag}`.slice(0, 20),
    password: 'correct horse battery',
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  return { c, userId: res.json<{ user: { id: string } }>().user.id };
}

let keyCounter = 0;
/** A fresh idempotency key. */
export const key = () => `key-${Date.now().toString(36)}-${(keyCounter += 1)}`;
