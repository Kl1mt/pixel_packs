import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import {
  CALENDAR_REWARDS,
  ENABLED_REALMS,
  PACK_PRICES,
  PITY_RULES,
  PityGroupSchema,
  PackTypeIdSchema,
  calendarDayIndex,
  calendarReward,
  claimFreePack as nextFreePackAnchor,
  freePackStatus,
  nextUtcMidnight,
  utcDayKey,
  type BuyPacksInput,
  type EconomyState,
  type PityMeter,
  type Realm,
  type Wallet,
} from '@pixel-packs/shared';
import {
  dailyClaims,
  packInventory,
  packOpenings,
  packPurchases,
  packTypes,
  pityCounters,
  wallets,
} from '../db/schema.js';
import { HttpError } from '../http/errors.js';
import type { EconomyCtx } from './context.js';
import { changeBalance, changePacks, lockWallet, type Tx, type WalletRow } from './db.js';

export const toWallet = (w: WalletRow): Wallet => ({ gold: w.gold, dust: w.dust, gems: w.gems });

async function calendarClaims(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(dailyClaims)
    .where(and(eq(dailyClaims.userId, userId), eq(dailyClaims.kind, 'calendar')));
  return row?.n ?? 0;
}

/** Everything the home screen needs: balances, packs, timers, pity and a pending reveal. */
export async function economyState(ctx: EconomyCtx, userId: string): Promise<EconomyState> {
  const now = ctx.now();
  return ctx.db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId, now);
    const packs = await tx
      .select({ packTypeId: packInventory.packTypeId, count: packInventory.count })
      .from(packInventory)
      .where(and(eq(packInventory.userId, userId), gt(packInventory.count, 0)))
      .orderBy(packInventory.packTypeId);
    const pity = await tx.select().from(pityCounters).where(eq(pityCounters.userId, userId));
    const claims = await calendarClaims(tx, userId);
    const [today] = await tx
      .select({ id: dailyClaims.id })
      .from(dailyClaims)
      .where(
        and(
          eq(dailyClaims.userId, userId),
          eq(dailyClaims.kind, 'calendar'),
          eq(dailyClaims.claimKey, utcDayKey(now)),
        ),
      );
    const [pending] = await tx
      .select({ id: packOpenings.id })
      .from(packOpenings)
      .where(and(eq(packOpenings.userId, userId), isNull(packOpenings.revealedAt)))
      .orderBy(desc(packOpenings.createdAt))
      .limit(1);
    const free = freePackStatus(wallet.freePackAnchor, now);
    const claimedToday = today !== undefined;
    return {
      wallet: toWallet(wallet),
      packs: packs.map((p) => ({
        packTypeId: PackTypeIdSchema.parse(p.packTypeId),
        count: p.count,
      })),
      freePack: { stored: free.stored, max: free.max, nextAt: free.nextAt?.toISOString() ?? null },
      calendar: {
        // Already claimed today: show the day that was paid; otherwise the next one.
        day: calendarDayIndex(claimedToday ? claims - 1 : claims) + 1,
        claimedToday,
        nextResetAt: nextUtcMidnight(now).toISOString(),
        rewards: CALENDAR_REWARDS.map((r) => ({ ...r })),
      },
      pity: PityGroupSchema.options.map((group): PityMeter => {
        const row = pity.find((p) => p.pityGroup === group);
        const rules = PITY_RULES[group];
        return {
          group,
          packsSinceLegendaryPlus: row?.packsSinceLegendaryPlus ?? 0,
          packsSinceMythic: row?.packsSinceMythic ?? 0,
          legendaryHardPity: rules.legendaryHardPity,
          mythicSoftPityStart: rules.mythicSoftPityStart,
          mythicHardPity: rules.mythicHardPity,
        };
      }),
      pendingOpeningId: pending?.id ?? null,
    };
  });
}

/** Claims one stored free pack as a realm pack of the player's choice (GDD §7). */
export async function claimFreePack(ctx: EconomyCtx, userId: string, realm: Realm): Promise<void> {
  if (!ENABLED_REALMS.includes(realm)) {
    throw new HttpError(400, 'packDisabled', 'That realm is not open yet.');
  }
  const now = ctx.now();
  await ctx.db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId, now);
    const anchor = nextFreePackAnchor(wallet.freePackAnchor, now);
    if (anchor === null) throw new HttpError(409, 'notReady', 'No free pack is ready yet.');
    const claimKey = anchor.toISOString();
    // The unique (user, kind, claim_key) is a second guard against double claims.
    const [claim] = await tx
      .insert(dailyClaims)
      .values({ userId, kind: 'freePack', claimKey, claimedAt: now })
      .returning({ id: dailyClaims.id });
    await tx.update(wallets).set({ freePackAnchor: anchor }).where(eq(wallets.userId, userId));
    await changePacks(tx, userId, `realm:${realm}`, 1, {
      reason: 'freePack',
      refId: claim?.id ?? null,
    });
  });
}

/** Claims today's calendar reward (GDD §8); one claim per UTC day. */
export async function claimCalendar(ctx: EconomyCtx, userId: string): Promise<void> {
  const now = ctx.now();
  await ctx.db.transaction(async (tx) => {
    await lockWallet(tx, userId, now);
    const claims = await calendarClaims(tx, userId);
    const inserted = await tx
      .insert(dailyClaims)
      .values({ userId, kind: 'calendar', claimKey: utcDayKey(now), claimedAt: now })
      .onConflictDoNothing()
      .returning({ id: dailyClaims.id });
    const claim = inserted[0];
    if (!claim) throw new HttpError(409, 'alreadyClaimed', 'Come back after the daily reset.');
    const day = calendarDayIndex(claims);
    const reward = calendarReward(day);
    const ref = { reason: 'calendar', refId: claim.id, meta: { day: day + 1 } };
    await changeBalance(tx, userId, 'gold', reward.gold, ref);
    await changeBalance(tx, userId, 'dust', reward.dust, ref);
  });
}

/** Buys packs into the inventory (GDD §7). A repeated idempotency key changes nothing. */
export async function buyPacks(
  ctx: EconomyCtx,
  userId: string,
  req: BuyPacksInput,
): Promise<{ replayed: boolean }> {
  const now = ctx.now();
  return ctx.db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, userId, now);
    const [previous] = await tx
      .select()
      .from(packPurchases)
      .where(
        and(eq(packPurchases.userId, userId), eq(packPurchases.idempotencyKey, req.idempotencyKey)),
      );
    if (previous) {
      if (previous.packTypeId !== req.packTypeId || previous.quantity !== req.quantity) {
        throw new HttpError(409, 'idempotencyConflict', 'This key was used for another purchase.');
      }
      return { replayed: true };
    }
    const [type] = await tx.select().from(packTypes).where(eq(packTypes.id, req.packTypeId));
    if (!type?.enabled) throw new HttpError(400, 'packDisabled', 'That pack is not available.');
    const price = PACK_PRICES[type.kind];
    const cost = price.amount * req.quantity;
    if (wallet[price.currency] < cost) {
      throw new HttpError(409, 'insufficientFunds', `Not enough ${price.currency}.`);
    }
    const [purchase] = await tx
      .insert(packPurchases)
      .values({
        userId,
        idempotencyKey: req.idempotencyKey,
        packTypeId: type.id,
        quantity: req.quantity,
        currency: price.currency,
        cost,
        createdAt: now,
      })
      .returning({ id: packPurchases.id });
    const ref = { reason: 'buyPack', refId: purchase?.id ?? null };
    await changeBalance(tx, userId, price.currency, -cost, ref);
    await changePacks(tx, userId, type.id, req.quantity, ref);
    return { replayed: false };
  });
}
