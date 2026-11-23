/**
 * Admin operations (GDD §23), used by `tools/admin` and by tests. Every change goes
 * through the same ledger helpers as the game, with an `admin:*` reason.
 */
import { eq, sql } from 'drizzle-orm';
import type { Currency, Rarity, Variant } from '@pixel-packs/shared';
import type { Db } from '../db/client.js';
import { devOddsOverrides, packTypes, users } from '../db/schema.js';
import { changeBalance, changePacks, lockWallet } from '../economy/db.js';

export { createDb, type DbHandle } from '../db/client.js';
export { runMigrations } from '../db/migrate.js';

export type AdminUser = typeof users.$inferSelect;

/** Finds a user by email or username (both case-insensitive). */
export async function findUser(db: Db, who: string): Promise<AdminUser | null> {
  const needle = who.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(
      needle.includes('@')
        ? eq(sql`lower(${users.email})`, needle)
        : eq(sql`lower(${users.username})`, needle),
    );
  return user ?? null;
}

export async function grantCurrency(
  db: Db,
  userId: string,
  currency: Currency,
  amount: number,
  note = '',
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockWallet(tx, userId, new Date());
    await changeBalance(tx, userId, currency, amount, { reason: 'admin:grant', meta: { note } });
  });
}

export async function grantPacks(
  db: Db,
  userId: string,
  packTypeId: string,
  count: number,
  note = '',
): Promise<void> {
  await db.transaction(async (tx) => {
    const [type] = await tx.select().from(packTypes).where(eq(packTypes.id, packTypeId));
    if (!type) throw new Error(`unknown pack type ${packTypeId}`);
    await lockWallet(tx, userId, new Date());
    await changePacks(tx, userId, packTypeId, count, { reason: 'admin:grant', meta: { note } });
  });
}

/**
 * Back to the start: the courier greets the player again and the next two realm packs
 * are the scripted onboarding packs. Starter cards already granted are not granted twice.
 */
export async function resetOnboarding(db: Db, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingStep: 0, onboardingStage: 'courier' })
    .where(eq(users.id, userId));
}

export interface OddsOverride {
  rarity?: Rarity;
  variant?: Variant;
  packs: number;
}

/** Dev only: forces the featured slot of the user's next `packs` packs. `packs: 0` clears it. */
export async function setOddsOverride(db: Db, userId: string, o: OddsOverride): Promise<void> {
  if (o.packs <= 0) {
    await db.delete(devOddsOverrides).where(eq(devOddsOverrides.userId, userId));
    return;
  }
  const row = {
    featuredRarity: o.rarity ?? null,
    featuredVariant: o.variant ?? null,
    remaining: o.packs,
  };
  await db
    .insert(devOddsOverrides)
    .values({ userId, ...row })
    .onConflictDoUpdate({ target: devOddsOverrides.userId, set: row });
}
