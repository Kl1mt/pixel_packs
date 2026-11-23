import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { STARTER_PACKS, initialFreePackAnchor, type Currency } from '@pixel-packs/shared';
import type { Db } from '../db/client.js';
import { ledger, packInventory, seasons, wallets } from '../db/schema.js';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type WalletRow = typeof wallets.$inferSelect;

/**
 * Locks the user's wallet row for the rest of the transaction. Every economy mutation
 * starts here, so one user's mutations run one after another (GDD §22).
 */
export async function lockWallet(tx: Tx, userId: string, now: Date): Promise<WalletRow> {
  const lock = () => tx.select().from(wallets).where(eq(wallets.userId, userId)).for('update');
  const [row] = await lock();
  if (row) return row;
  // Accounts from before T10 may lack a wallet (register creates one).
  await tx
    .insert(wallets)
    .values({ userId, freePackAnchor: initialFreePackAnchor(now) })
    .onConflictDoNothing();
  const [created] = await lock();
  if (!created) throw new Error(`no wallet for ${userId}`);
  return created;
}

export interface LedgerRef {
  reason: string;
  refId?: string | null;
  meta?: Record<string, unknown>;
}

/** Changes one balance and appends the ledger entry. The CHECK keeps balances ≥ 0. */
export async function changeBalance(
  tx: Tx,
  userId: string,
  currency: Currency,
  delta: number,
  ref: LedgerRef,
): Promise<void> {
  if (delta === 0) return;
  const column = wallets[currency];
  await tx
    .update(wallets)
    .set({ [currency]: sql`${column} + ${delta}`, updatedAt: sql`now()` })
    .where(eq(wallets.userId, userId));
  await tx.insert(ledger).values({
    userId,
    currency,
    delta,
    reason: ref.reason,
    refId: ref.refId ?? null,
    meta: ref.meta ?? null,
  });
}

/** Adds unopened packs, with a ledger entry. */
export async function changePacks(
  tx: Tx,
  userId: string,
  packTypeId: string,
  delta: number,
  ref: LedgerRef,
): Promise<void> {
  if (!Number.isInteger(delta) || delta < 1) throw new RangeError(`bad pack delta ${delta}`);
  await tx
    .insert(packInventory)
    .values({ userId, packTypeId, count: delta })
    .onConflictDoUpdate({
      target: [packInventory.userId, packInventory.packTypeId],
      set: { count: sql`${packInventory.count} + ${delta}` },
    });
  await packLedger(tx, userId, packTypeId, delta, ref);
}

async function packLedger(
  tx: Tx,
  userId: string,
  packTypeId: string,
  delta: number,
  ref: LedgerRef,
): Promise<void> {
  await tx.insert(ledger).values({
    userId,
    packTypeId,
    delta,
    reason: ref.reason,
    refId: ref.refId ?? null,
    meta: ref.meta ?? null,
  });
}

/** Removes one pack (with a ledger entry) if the user has one; false otherwise. */
export async function takePack(
  tx: Tx,
  userId: string,
  packTypeId: string,
  ref: LedgerRef,
): Promise<boolean> {
  const rows = await tx
    .update(packInventory)
    .set({ count: sql`${packInventory.count} - 1` })
    .where(
      and(
        eq(packInventory.userId, userId),
        eq(packInventory.packTypeId, packTypeId),
        gt(packInventory.count, 0),
      ),
    )
    .returning({ count: packInventory.count });
  if (rows.length === 0) return false;
  await packLedger(tx, userId, packTypeId, -1, ref);
  return true;
}

/** The season running at `now` (Season 0 before launch). */
export async function currentSeason(tx: Tx | Db, now: Date): Promise<number> {
  const [row] = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(lte(seasons.startsAt, now), or(isNull(seasons.endsAt), gt(seasons.endsAt, now))))
    .orderBy(desc(seasons.id))
    .limit(1);
  return row?.id ?? 0;
}

/** The starter satchel (GDD §17): the two scripted packs, granted inside registration. */
export async function grantStarterSatchel(tx: Tx, userId: string): Promise<void> {
  for (const realm of STARTER_PACKS) {
    await changePacks(tx, userId, `realm:${realm}`, 1, { reason: 'starterSatchel' });
  }
}
