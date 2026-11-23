import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { initialFreePackAnchor, type PublicUser, type RegisterRequest } from '@pixel-packs/shared';
import type { Db } from '../db/client.js';
import { emailTokens, sessions, users, wallets, type EmailTokenPurpose } from '../db/schema.js';
import { HttpError } from '../http/errors.js';
import { grantStarterSatchel } from '../economy/db.js';
import { hashToken, randomToken } from './crypto.js';
import { hashPassword, verifyPassword } from './password.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_MS: Record<EmailTokenPurpose, number> = {
  verifyEmail: 24 * 60 * 60 * 1000,
  resetPassword: 60 * 60 * 1000,
};
/** `last_seen_at` is refreshed at most this often, to avoid a write per request. */
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export type User = typeof users.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    emailVerified: u.emailVerifiedAt !== null,
    onboardingStep: u.onboardingStep,
    createdAt: u.createdAt.toISOString(),
  };
}

export interface SessionInfo {
  token: string;
  expiresAt: Date;
}

export interface AuthService {
  register(
    input: RegisterRequest,
    userAgent?: string,
  ): Promise<{ user: User; session: SessionInfo; verifyToken: string }>;
  login(
    email: string,
    password: string,
    userAgent?: string,
  ): Promise<{ user: User; session: SessionInfo } | null>;
  sessionUser(token: string): Promise<{ user: User; sessionId: string } | null>;
  logout(token: string): Promise<void>;
  createEmailToken(userId: string, purpose: EmailTokenPurpose): Promise<string>;
  verifyEmail(token: string): Promise<boolean>;
  findUserByEmail(email: string): Promise<User | null>;
  resetPassword(token: string, password: string): Promise<boolean>;
}

function uniqueViolation(err: unknown): string | null {
  for (
    let e: unknown = err;
    typeof e === 'object' && e !== null;
    e = (e as { cause?: unknown }).cause
  ) {
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (code === '23505') return typeof constraint === 'string' ? constraint : '';
  }
  return null;
}

export function createAuthService(db: Db, now: () => Date = () => new Date()): AuthService {
  async function createSession(
    tx: Db | Tx,
    userId: string,
    userAgent?: string,
  ): Promise<SessionInfo> {
    const token = randomToken();
    const expiresAt = new Date(now().getTime() + SESSION_TTL_MS);
    await tx.insert(sessions).values({
      id: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 256) ?? null,
    });
    return { token, expiresAt };
  }

  async function insertEmailToken(tx: Db | Tx, userId: string, purpose: EmailTokenPurpose) {
    const token = randomToken();
    await tx.insert(emailTokens).values({
      id: hashToken(token),
      userId,
      purpose,
      expiresAt: new Date(now().getTime() + TOKEN_TTL_MS[purpose]),
    });
    return token;
  }

  /** Marks a live token used and returns its user id, or null if invalid/expired/used. */
  async function consumeToken(
    tx: Tx,
    token: string,
    purpose: EmailTokenPurpose,
  ): Promise<string | null> {
    const [row] = await tx
      .update(emailTokens)
      .set({ usedAt: now() })
      .where(
        and(
          eq(emailTokens.id, hashToken(token)),
          eq(emailTokens.purpose, purpose),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, now()),
        ),
      )
      .returning({ userId: emailTokens.userId });
    return row?.userId ?? null;
  }

  const findUserByEmail = async (email: string) => {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()));
    return u ?? null;
  };

  return {
    findUserByEmail,

    async register(input, userAgent) {
      const passwordHash = await hashPassword(input.password);
      try {
        return await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({ email: input.email, username: input.username, passwordHash })
            .returning();
          if (!user) throw new Error('insert returned no user');
          await tx
            .insert(wallets)
            .values({ userId: user.id, freePackAnchor: initialFreePackAnchor(now()) });
          await grantStarterSatchel(tx, user.id);
          const session = await createSession(tx, user.id, userAgent);
          const verifyToken = await insertEmailToken(tx, user.id, 'verifyEmail');
          return { user, session, verifyToken };
        });
      } catch (err) {
        const constraint = uniqueViolation(err);
        if (constraint === null) throw err;
        if (constraint.includes('username')) {
          throw new HttpError(409, 'usernameTaken', 'That username is already taken.');
        }
        throw new HttpError(409, 'emailTaken', 'An account with this email already exists.');
      }
    },

    async login(email, password, userAgent) {
      const user = await findUserByEmail(email);
      const ok = await verifyPassword(user?.passwordHash ?? null, password);
      if (!user || !ok) return null;
      return { user, session: await createSession(db, user.id, userAgent) };
    },

    async sessionUser(token) {
      const id = hashToken(token);
      const [row] = await db
        .select({ user: users, lastSeenAt: sessions.lastSeenAt })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now())));
      if (!row) return null;
      if (now().getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
        await db.update(sessions).set({ lastSeenAt: now() }).where(eq(sessions.id, id));
      }
      return { user: row.user, sessionId: id };
    },

    async logout(token) {
      await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
    },

    createEmailToken: (userId, purpose) => insertEmailToken(db, userId, purpose),

    verifyEmail(token) {
      return db.transaction(async (tx) => {
        const userId = await consumeToken(tx, token, 'verifyEmail');
        if (userId === null) return false;
        await tx
          .update(users)
          .set({ emailVerifiedAt: now(), updatedAt: now() })
          .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)));
        return true;
      });
    },

    async resetPassword(token, password) {
      const passwordHash = await hashPassword(password);
      return db.transaction(async (tx) => {
        const userId = await consumeToken(tx, token, 'resetPassword');
        if (userId === null) return false;
        // The link proved access to the inbox, so it also verifies the email.
        await tx
          .update(users)
          .set({
            passwordHash,
            updatedAt: now(),
            emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
          })
          .where(eq(users.id, userId));
        // Log out everywhere and void other reset links.
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx
          .update(emailTokens)
          .set({ usedAt: now() })
          .where(
            and(
              eq(emailTokens.userId, userId),
              eq(emailTokens.purpose, 'resetPassword'),
              isNull(emailTokens.usedAt),
            ),
          );
        return true;
      });
    },
  };
}
