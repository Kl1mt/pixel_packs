import type { FastifyInstance } from 'fastify';
import {
  LoginRequestSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RegisterRequestSchema,
  VerifyEmailRequestSchema,
  type CsrfResponse,
  type UserResponse,
} from '@pixel-packs/shared';
import type { Mailer } from '../mail/mailer.js';
import { HttpError } from '../http/errors.js';
import { passwordResetEmail, verificationEmail } from './emails.js';
import {
  clearSessionCookie,
  ensureCsrfToken,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
  type CookieSettings,
} from './plugin.js';
import { toPublicUser, type AuthService } from './service.js';

export interface AuthRouteDeps {
  auth: AuthService;
  mailer: Mailer;
  cookies: CookieSettings;
  /** Client origin for links in emails, e.g. `http://localhost:5173`. */
  appOrigin: string;
}

/** Per-IP limits (GDD §22). `max` requests per `timeWindow`. */
const LIMITS = {
  login: { max: 10, timeWindow: '1 minute' },
  register: { max: 5, timeWindow: '10 minutes' },
  email: { max: 5, timeWindow: '15 minutes' },
  token: { max: 20, timeWindow: '15 minutes' },
} as const;

const limit = (l: (typeof LIMITS)[keyof typeof LIMITS]) => ({ config: { rateLimit: l } });

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const { auth, mailer, cookies } = deps;
  const link = (path: string, token: string) => `${deps.appOrigin}${path}?token=${token}`;

  app.get('/api/auth/csrf', (req, reply): CsrfResponse => ({
    csrfToken: ensureCsrfToken(req, reply, cookies),
  }));

  app.post(
    '/api/auth/register',
    limit(LIMITS.register),
    async (req, reply): Promise<UserResponse> => {
      const input = RegisterRequestSchema.parse(req.body);
      const { user, session, verifyToken } = await auth.register(input, req.headers['user-agent']);
      await mailer.send(
        verificationEmail(user.email, user.username, link('/verify-email', verifyToken)),
      );
      setSessionCookie(reply, session, cookies);
      reply.status(201);
      return { user: toPublicUser(user) };
    },
  );

  app.post('/api/auth/login', limit(LIMITS.login), async (req, reply): Promise<UserResponse> => {
    const { email, password } = LoginRequestSchema.parse(req.body);
    const result = await auth.login(email, password, req.headers['user-agent']);
    if (!result) throw new HttpError(401, 'invalidCredentials', 'Email or password is wrong.');
    setSessionCookie(reply, result.session, cookies);
    return { user: toPublicUser(result.user) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token !== undefined) await auth.logout(token);
    clearSessionCookie(reply, cookies);
    return reply.status(204).send();
  });

  app.get('/api/auth/me', (req): UserResponse => ({ user: toPublicUser(requireAuth(req).user) }));

  app.post('/api/auth/verify-email', limit(LIMITS.token), async (req, reply) => {
    const { token } = VerifyEmailRequestSchema.parse(req.body);
    if (!(await auth.verifyEmail(token))) {
      throw new HttpError(400, 'invalidToken', 'This link is invalid or has expired.');
    }
    return reply.status(204).send();
  });

  app.post('/api/auth/resend-verification', limit(LIMITS.email), async (req, reply) => {
    const { user } = requireAuth(req);
    if (user.emailVerifiedAt === null) {
      const token = await auth.createEmailToken(user.id, 'verifyEmail');
      await mailer.send(verificationEmail(user.email, user.username, link('/verify-email', token)));
    }
    return reply.status(204).send();
  });

  // Always 202, so the response doesn't reveal whether the email has an account.
  app.post('/api/auth/password-reset/request', limit(LIMITS.email), async (req, reply) => {
    const { email } = PasswordResetRequestSchema.parse(req.body);
    const user = await auth.findUserByEmail(email);
    if (user) {
      const token = await auth.createEmailToken(user.id, 'resetPassword');
      await mailer.send(
        passwordResetEmail(user.email, user.username, link('/reset-password', token)),
      );
    }
    return reply.status(202).send();
  });

  app.post('/api/auth/password-reset/confirm', limit(LIMITS.token), async (req, reply) => {
    const { token, password } = PasswordResetConfirmSchema.parse(req.body);
    if (!(await auth.resetPassword(token, password))) {
      throw new HttpError(400, 'invalidToken', 'This link is invalid or has expired.');
    }
    clearSessionCookie(reply, cookies);
    return reply.status(204).send();
  });
}
