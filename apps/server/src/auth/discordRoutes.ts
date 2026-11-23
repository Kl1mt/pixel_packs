import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  OAuthModeSchema,
  type AuthProvidersResponse,
  type LinkedAccountsResponse,
  type OAuthMode,
  type OAuthOutcome,
} from '@pixel-packs/shared';
import type { Mailer } from '../mail/mailer.js';
import { HttpError } from '../http/errors.js';
import { randomToken, safeEqual } from './crypto.js';
import type { DiscordClient } from './discord.js';
import { verificationEmail } from './emails.js';
import type { OAuthService } from './oauth.js';
import { requireAuth, setSessionCookie, type CookieSettings } from './plugin.js';
import type { AuthService } from './service.js';

export const OAUTH_STATE_COOKIE = 'pp_oauth';
const STATE_PATH = '/api/auth/discord';
const STATE_TTL_S = 10 * 60;

export interface DiscordRouteDeps {
  auth: AuthService;
  oauth: OAuthService;
  /** Null when the Discord credentials are not configured: the routes 404 and the button hides. */
  discord: DiscordClient | null;
  mailer: Mailer;
  cookies: CookieSettings;
  appOrigin: string;
}

const StartQuerySchema = z.object({ mode: OAuthModeSchema.default('login') });
const CallbackQuerySchema = z.object({
  code: z.string().min(1).max(512).optional(),
  state: z.string().max(128).optional(),
  error: z.string().max(128).optional(),
});
/** Cookie value `<state>.<mode>`; the state is a random 43-char token. */
const STATE_COOKIE_RE = /^([A-Za-z0-9_-]{43})\.(login|link)$/;

const limit = { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } };

/**
 * Discord OAuth (GDD §22): `start` sets a short-lived httpOnly `state` cookie and
 * redirects to Discord; `callback` checks it, then logs in, signs up or links.
 * Results go back to the client as `/login?oauth=…` or `/settings?discord=…`.
 */
export function registerDiscordRoutes(app: FastifyInstance, deps: DiscordRouteDeps): void {
  const { discord, oauth, cookies } = deps;
  const origin = deps.appOrigin.replace(/\/$/, '');
  const to = (reply: FastifyReply, path: string) => reply.redirect(`${origin}${path}`, 302);
  const loginFail = (reply: FastifyReply, outcome: OAuthOutcome) =>
    to(reply, `/login?oauth=${outcome}`);
  const settingsResult = (reply: FastifyReply, outcome: OAuthOutcome) =>
    to(reply, `/settings?discord=${outcome}`);

  app.get('/api/auth/providers', (): AuthProvidersResponse => ({ discord: discord !== null }));

  app.get('/api/auth/linked', (req): Promise<LinkedAccountsResponse> =>
    oauth.linkedAccounts(requireAuth(req).user),
  );

  app.post('/api/auth/discord/unlink', limit, async (req, reply) => {
    await oauth.unlinkDiscord(requireAuth(req).user);
    return reply.status(204).send();
  });

  const requireDiscord = (): DiscordClient => {
    if (discord === null) throw new HttpError(404, 'notFound', 'Discord login is not set up.');
    return discord;
  };

  app.get('/api/auth/discord/start', limit, (req, reply) => {
    const client = requireDiscord();
    const { mode } = StartQuerySchema.parse(req.query);
    if (mode === 'link' && req.auth === null) return loginFail(reply, 'loginRequired');
    const state = randomToken();
    reply.setCookie(OAUTH_STATE_COOKIE, `${state}.${mode}`, {
      path: STATE_PATH,
      httpOnly: true,
      // Lax still sends the cookie on Discord's top-level redirect back to us.
      sameSite: 'lax',
      secure: cookies.secure,
      maxAge: STATE_TTL_S,
    });
    return reply.redirect(client.authorizeUrl(state), 302);
  });

  app.get('/api/auth/discord/callback', limit, async (req, reply) => {
    const client = requireDiscord();
    const query = CallbackQuerySchema.safeParse(req.query);
    const saved = STATE_COOKIE_RE.exec(req.cookies[OAUTH_STATE_COOKIE] ?? '');
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: STATE_PATH });
    const mode: OAuthMode = saved?.[2] === 'link' ? 'link' : 'login';
    const fail = (outcome: OAuthOutcome) =>
      mode === 'link' ? settingsResult(reply, outcome) : loginFail(reply, outcome);

    if (!query.success || !saved?.[1] || query.data.state === undefined) return fail('failed');
    if (!safeEqual(saved[1], query.data.state)) return fail('failed');
    if (query.data.error !== undefined) return fail('denied');
    if (query.data.code === undefined) return fail('failed');

    let identity;
    try {
      identity = await client.exchange(query.data.code);
    } catch (err) {
      req.log.warn({ err }, 'Discord OAuth exchange failed');
      return fail('failed');
    }

    if (mode === 'link') {
      if (req.auth === null) return loginFail(reply, 'loginRequired');
      return settingsResult(reply, await oauth.linkDiscord(req.auth.user.id, identity));
    }

    const result = await oauth.loginWithDiscord(identity, userAgent(req));
    if (result.kind !== 'session') return loginFail(reply, result.kind);
    setSessionCookie(reply, result.session, cookies);
    if (result.isNew && result.user.emailVerifiedAt === null) {
      const token = await deps.auth.createEmailToken(result.user.id, 'verifyEmail');
      await deps.mailer.send(
        verificationEmail(
          result.user.email,
          result.user.username,
          `${origin}/verify-email?token=${token}`,
        ),
      );
    }
    return to(reply, '/');
  });
}

const userAgent = (req: FastifyRequest) => req.headers['user-agent'];
