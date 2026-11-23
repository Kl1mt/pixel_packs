import { sql } from 'drizzle-orm';
import { index, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Accounts (GDD §22). Email and username are stored as typed; uniqueness ignores case. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    /** Null for accounts that only log in via OAuth (T09). */
    passwordHash: text('password_hash'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /** Scripted onboarding packs opened so far (GDD §17); 2 = done. */
    onboardingStep: smallint('onboarding_step').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    uniqueIndex('users_username_lower_uq').on(sql`lower(${t.username})`),
  ],
);

/** Login sessions. `id` is the SHA-256 of the cookie token, so a DB leak exposes no sessions. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const EMAIL_TOKEN_PURPOSES = ['verifyEmail', 'resetPassword'] as const;
export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];

/** Single-use tokens for email verification and password reset (hashed like sessions). */
export const emailTokens = pgTable(
  'email_tokens',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose', { enum: EMAIL_TOKEN_PURPOSES }).notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [index('email_tokens_user_purpose_idx').on(t.userId, t.purpose)],
);

export const OAUTH_PROVIDERS = ['discord'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** External logins linked to a user (T09: Discord). One per provider and user. */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: OAUTH_PROVIDERS }).notNull(),
    /** The provider's stable user id (Discord snowflake). */
    providerUserId: text('provider_user_id').notNull(),
    /** Display name at the provider, refreshed on every login. */
    providerUsername: text('provider_username').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('oauth_accounts_provider_uid_uq').on(t.provider, t.providerUserId),
    uniqueIndex('oauth_accounts_user_provider_uq').on(t.userId, t.provider),
  ],
);
