import { and, eq, sql } from 'drizzle-orm';
import type { LinkedAccountsResponse } from '@pixel-packs/shared';
import type { Db } from '../db/client.js';
import { oauthAccounts, users, type OAuthProvider } from '../db/schema.js';
import { HttpError } from '../http/errors.js';
import { usernameBaseFromDiscord, usernameCandidate, type DiscordIdentity } from './discord.js';
import {
  insertPlayer,
  insertSession,
  uniqueViolation,
  type SessionInfo,
  type User,
} from './service.js';

export type OAuthLoginResult =
  | { kind: 'session'; user: User; session: SessionInfo; isNew: boolean }
  /** An account with this email exists but the link can't be proven safe (§29). */
  | { kind: 'emailExists' }
  | { kind: 'noEmail' };

export interface OAuthService {
  /** Log in with Discord, linking to or creating an account as needed. */
  loginWithDiscord(identity: DiscordIdentity, userAgent?: string): Promise<OAuthLoginResult>;
  /** Links Discord to a logged-in user; `taken` if that Discord is on another account. */
  linkDiscord(userId: string, identity: DiscordIdentity): Promise<'linked' | 'taken'>;
  /** Removes the Discord link; refuses if it is the account's only way to log in. */
  unlinkDiscord(user: User): Promise<void>;
  linkedAccounts(user: User): Promise<LinkedAccountsResponse>;
}

const PROVIDER: OAuthProvider = 'discord';
const USERNAME_ATTEMPTS = 8;

export function createOAuthService(
  db: Db,
  now: () => Date = () => new Date(),
  rand: () => number = Math.random,
): OAuthService {
  const findLink = async (providerUserId: string) => {
    const [row] = await db
      .select({ user: users, linkId: oauthAccounts.id })
      .from(oauthAccounts)
      .innerJoin(users, eq(users.id, oauthAccounts.userId))
      .where(
        and(eq(oauthAccounts.provider, PROVIDER), eq(oauthAccounts.providerUserId, providerUserId)),
      );
    return row ?? null;
  };

  const linkRow = (userId: string, identity: DiscordIdentity) => ({
    userId,
    provider: PROVIDER,
    providerUserId: identity.id,
    providerUsername: identity.displayName,
  });

  /** New account from a Discord identity; retries with a tagged username on collisions. */
  async function createFromDiscord(identity: DiscordIdentity, email: string, userAgent?: string) {
    const base = usernameBaseFromDiscord(identity.username);
    for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
      const username = usernameCandidate(base, attempt, rand);
      try {
        return await db.transaction(async (tx) => {
          const user = await insertPlayer(
            tx,
            {
              email,
              username,
              passwordHash: null,
              emailVerifiedAt: identity.emailVerified ? now() : null,
            },
            now(),
          );
          await tx.insert(oauthAccounts).values(linkRow(user.id, identity));
          return { user, session: await insertSession(tx, user.id, now(), userAgent) };
        });
      } catch (err) {
        const constraint = uniqueViolation(err);
        if (constraint === null) throw err;
        if (!constraint.includes('username')) return null; // email or Discord id raced us
      }
    }
    throw new Error('could not find a free username');
  }

  async function linkDiscord(
    userId: string,
    identity: DiscordIdentity,
  ): Promise<'linked' | 'taken'> {
    const linked = await findLink(identity.id);
    if (linked) return linked.user.id === userId ? 'linked' : 'taken';
    try {
      await db.insert(oauthAccounts).values(linkRow(userId, identity));
      return 'linked';
    } catch (err) {
      // The user already has a different Discord, or this one was linked meanwhile.
      if (uniqueViolation(err) !== null) return 'taken';
      throw err;
    }
  }

  return {
    async loginWithDiscord(identity, userAgent) {
      const linked = await findLink(identity.id);
      if (linked) {
        await db
          .update(oauthAccounts)
          .set({ providerUsername: identity.displayName })
          .where(eq(oauthAccounts.id, linked.linkId));
        const session = await insertSession(db, linked.user.id, now(), userAgent);
        return { kind: 'session', user: linked.user, session, isNew: false };
      }
      if (identity.email === null) return { kind: 'noEmail' };

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(sql`lower(${users.email})`, identity.email.toLowerCase()));
      if (existing) {
        // Auto-link only when both sides have proven the inbox; otherwise someone could
        // pre-register a victim's email, or a Discord account could claim one it doesn't own.
        if (!identity.emailVerified || existing.emailVerifiedAt === null) {
          return { kind: 'emailExists' };
        }
        if ((await linkDiscord(existing.id, identity)) === 'taken') {
          return { kind: 'emailExists' };
        }
        const session = await insertSession(db, existing.id, now(), userAgent);
        return { kind: 'session', user: existing, session, isNew: false };
      }

      const created = await createFromDiscord(identity, identity.email, userAgent);
      if (created === null) return { kind: 'emailExists' };
      return { kind: 'session', ...created, isNew: true };
    },

    linkDiscord,

    async unlinkDiscord(user) {
      if (user.passwordHash === null) {
        throw new HttpError(
          409,
          'lastLoginMethod',
          'Discord is your only way to log in. Set a password first (use "Forgot password").',
        );
      }
      await db
        .delete(oauthAccounts)
        .where(and(eq(oauthAccounts.userId, user.id), eq(oauthAccounts.provider, PROVIDER)));
    },

    async linkedAccounts(user) {
      const [row] = await db
        .select({ username: oauthAccounts.providerUsername })
        .from(oauthAccounts)
        .where(and(eq(oauthAccounts.userId, user.id), eq(oauthAccounts.provider, PROVIDER)));
      return { hasPassword: user.passwordHash !== null, discord: row ?? null };
    },
  };
}
