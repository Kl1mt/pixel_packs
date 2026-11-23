import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  RARITIES,
  REALMS,
  VARIANTS,
  type Ability,
  type CopySource,
  type PityGroup,
  type RolledCard,
} from '@pixel-packs/shared';
import { users } from './auth.js';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const userRef = () =>
  uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' });

// Drizzle text enums need non-empty tuples; Zod's `.options` are plain arrays.
const COPY_SOURCES = [
  'pack',
  'craft',
  'fusion',
  'starter',
] as const satisfies readonly CopySource[];
const PITY_GROUPS = ['realm', 'mythic'] as const satisfies readonly PityGroup[];

export const CURRENCIES = ['gold', 'dust', 'gems'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Seasons (GDD §6, §13). Season 0 is seeded by the first migration and never stamps. */
export const seasons = pgTable('seasons', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
});

/** Catalog mirror, synced from `packages/shared` on server start. Removed cards are retired, never deleted. */
export const cards = pgTable('cards', {
  id: text('id').primaryKey(),
  set: text('set').notNull(),
  name: text('name').notNull(),
  realm: text('realm', { enum: REALMS }).notNull(),
  rarity: text('rarity', { enum: RARITIES }).notNull(),
  atk: integer('atk').notNull(),
  hp: integer('hp').notNull(),
  abilities: jsonb('abilities').$type<Ability[]>().notNull(),
  flavour: text('flavour').notNull(),
  event: boolean('event').notNull(),
  craftable: boolean('craftable').notNull(),
  retired: boolean('retired').notNull().default(false),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Pack types, synced from the shared config on server start. Ids: `realm:<realm>`, `mythic`. */
export const packTypes = pgTable('pack_types', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['realm', 'mythic'] }).notNull(),
  realm: text('realm', { enum: REALMS }),
  pityGroup: text('pity_group', { enum: PITY_GROUPS }).notNull(),
  /** Season in which this pack was released (First-Edition stamps, GDD §6). */
  releaseSeason: integer('release_season')
    .notNull()
    .references(() => seasons.id),
  enabled: boolean('enabled').notNull(),
});

export const wallets = pgTable(
  'wallets',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    gold: integer('gold').notNull().default(0),
    dust: integer('dust').notNull().default(0),
    gems: integer('gems').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('wallets_non_negative', sql`${t.gold} >= 0 and ${t.dust} >= 0 and ${t.gems} >= 0`)],
);

/** Unopened packs per user and type. */
export const packInventory = pgTable(
  'pack_inventory',
  {
    userId: userRef(),
    packTypeId: text('pack_type_id')
      .notNull()
      .references(() => packTypes.id),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.packTypeId] }),
    check('pack_inventory_non_negative', sql`${t.count} >= 0`),
  ],
);

/** One row per opened pack. `(user_id, idempotency_key)` makes retries safe (GDD §21). */
export const packOpenings = pgTable(
  'pack_openings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    packTypeId: text('pack_type_id')
      .notNull()
      .references(() => packTypes.id),
    idempotencyKey: text('idempotency_key').notNull(),
    scripted: boolean('scripted').notNull(),
    pityTrigger: text('pity_trigger', { enum: ['legendaryHard', 'mythicHard'] }),
    mythicSoftPityBonus: integer('mythic_soft_pity_bonus').notNull().default(0),
    cards: jsonb('cards').$type<RolledCard[]>().notNull(),
    /** Set once the client has shown the full reveal; open ones can be resumed. */
    revealedAt: timestamp('revealed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('pack_openings_idempotency_uq').on(t.userId, t.idempotencyKey),
    index('pack_openings_user_created_idx').on(t.userId, t.createdAt),
  ],
);

/** Owned card copies with all traits (GDD §4, §6). */
export const userCards = pgTable(
  'user_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id),
    variant: text('variant', { enum: VARIANTS }).notNull(),
    stars: smallint('stars').notNull().default(1),
    /** "1st Edition · S‹n›" season, or null for no stamp. */
    editionSeason: integer('edition_season').references(() => seasons.id),
    mintNumber: integer('mint_number'),
    source: text('source', { enum: COPY_SOURCES }).notNull(),
    packOpeningId: uuid('pack_opening_id').references(() => packOpenings.id),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
    tradeLockUntil: timestamp('trade_lock_until', { withTimezone: true }),
    accountBound: boolean('account_bound').notNull().default(false),
  },
  (t) => [
    index('user_cards_user_card_idx').on(t.userId, t.cardId),
    uniqueIndex('user_cards_mint_uq')
      .on(t.cardId, t.variant, t.mintNumber)
      .where(sql`${t.mintNumber} is not null`),
    check('user_cards_stars', sql`${t.stars} between 1 and 3`),
  ],
);

/** Append-only log of every currency or card change, with a reason (GDD §21). */
export const ledger = pgTable(
  'ledger',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: userRef(),
    /** Set for currency changes; null for card-only entries. */
    currency: text('currency', { enum: CURRENCIES }),
    delta: integer('delta').notNull().default(0),
    userCardId: uuid('user_card_id').references(() => userCards.id),
    packTypeId: text('pack_type_id').references(() => packTypes.id),
    reason: text('reason').notNull(),
    /** Id of the action that caused it, e.g. a pack opening or a claim. */
    refId: text('ref_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('ledger_user_created_idx').on(t.userId, t.createdAt)],
);

export const pityCounters = pgTable(
  'pity_counters',
  {
    userId: userRef(),
    pityGroup: text('pity_group', { enum: PITY_GROUPS }).notNull(),
    packsSinceLegendaryPlus: integer('packs_since_legendary_plus').notNull().default(0),
    packsSinceMythic: integer('packs_since_mythic').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pityGroup] })],
);

/** Last mint number handed out per (card, variant); numbers are never reused. */
export const mintCounters = pgTable(
  'mint_counters',
  {
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id),
    variant: text('variant', { enum: VARIANTS }).notNull(),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.variant] })],
);

/** Free-pack and calendar claims. `claim_key` (e.g. a slot time or day) blocks double claims. */
export const dailyClaims = pgTable(
  'daily_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    kind: text('kind', { enum: ['freePack', 'calendar'] }).notNull(),
    claimKey: text('claim_key').notNull(),
    claimedAt: createdAt(),
  },
  (t) => [uniqueIndex('daily_claims_uq').on(t.userId, t.kind, t.claimKey)],
);
