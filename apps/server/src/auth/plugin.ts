import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CSRF_HEADER } from '@pixel-packs/shared';
import { HttpError, sendError } from '../http/errors.js';
import { randomToken, safeEqual } from './crypto.js';
import type { AuthService, SessionInfo, User } from './service.js';

export const SESSION_COOKIE = 'pp_session';
export const CSRF_COOKIE = 'pp_csrf';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface RequestAuth {
  user: User;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestAuth | null;
  }
}

export interface CookieSettings {
  secure: boolean;
}

/**
 * Session + CSRF hooks (GDD §22):
 * - the session cookie is httpOnly + SameSite=Lax; `request.auth` is filled from it;
 * - CSRF is a double-submit token: a readable `pp_csrf` cookie that every mutation
 *   must echo in the `x-csrf-token` header (other sites can't read our cookies).
 */
export function registerAuthHooks(
  app: FastifyInstance,
  auth: AuthService,
  cookies: CookieSettings,
): void {
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (req, reply) => {
    if (!SAFE_METHODS.has(req.method)) {
      const cookie = req.cookies[CSRF_COOKIE];
      const header = req.headers[CSRF_HEADER];
      if (
        cookie === undefined ||
        typeof header !== 'string' ||
        !TOKEN_RE.test(cookie) ||
        !safeEqual(cookie, header)
      ) {
        return sendError(reply, 403, 'csrf', 'Missing or invalid CSRF token.');
      }
    }
    const token = req.cookies[SESSION_COOKIE];
    if (token !== undefined && TOKEN_RE.test(token)) {
      req.auth = await auth.sessionUser(token);
      if (req.auth === null) clearSessionCookie(reply, cookies);
    }
    return undefined;
  });
}

/** Returns the CSRF token, issuing a new cookie if the request has none. */
export function ensureCsrfToken(
  req: FastifyRequest,
  reply: FastifyReply,
  cookies: CookieSettings,
): string {
  const existing = req.cookies[CSRF_COOKIE];
  if (existing !== undefined && TOKEN_RE.test(existing)) return existing;
  const token = randomToken();
  reply.setCookie(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: cookies.secure,
    maxAge: 365 * 24 * 60 * 60,
  });
  return token;
}

export function setSessionCookie(
  reply: FastifyReply,
  session: SessionInfo,
  cookies: CookieSettings,
): void {
  reply.setCookie(SESSION_COOKIE, session.token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: cookies.secure,
    expires: session.expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, cookies: CookieSettings): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: cookies.secure,
  });
}

/** The logged-in user, or a 401. */
export function requireAuth(req: FastifyRequest): RequestAuth {
  if (req.auth === null) throw new HttpError(401, 'unauthorized', 'Please log in.');
  return req.auth;
}
