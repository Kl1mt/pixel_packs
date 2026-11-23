import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  StarsSchema,
  canDust,
  dustTotal,
  planDustExtras,
  type DustExtrasPreview,
  type DustResponse,
  type DustableCopy,
} from '@pixel-packs/shared';
import { cards, ledger, userCards } from '../db/schema.js';
import { HttpError } from '../http/errors.js';
import type { EconomyCtx } from './context.js';
import { changeBalance, lockWallet, type Tx } from './db.js';
import { toWallet } from './state.js';

/** The user's live copies (optionally only `ids`), with the card's rarity. */
async function liveCopies(
  tx: Tx,
  userId: string,
  ids?: readonly string[],
): Promise<DustableCopy[]> {
  const rows = await tx
    .select({
      id: userCards.id,
      cardId: userCards.cardId,
      rarity: cards.rarity,
      variant: userCards.variant,
      stars: userCards.stars,
      editionSeason: userCards.editionSeason,
      mintNumber: userCards.mintNumber,
      accountBound: userCards.accountBound,
    })
    .from(userCards)
    .innerJoin(cards, eq(cards.id, userCards.cardId))
    .where(
      and(
        eq(userCards.userId, userId),
        isNull(userCards.removedAt),
        ids ? inArray(userCards.id, [...ids]) : undefined,
      ),
    );
  return rows.map((r) => ({ ...r, stars: StarsSchema.parse(r.stars) }));
}

async function dustInTx(
  tx: Tx,
  userId: string,
  copies: readonly DustableCopy[],
  reason: string,
  now: Date,
): Promise<number> {
  const dust = dustTotal(copies);
  if (copies.length === 0) return 0;
  await tx
    .update(userCards)
    .set({ removedAt: now, removedReason: 'dust' })
    .where(
      inArray(
        userCards.id,
        copies.map((c) => c.id),
      ),
    );
  await tx
    .insert(ledger)
    .values(copies.map((c) => ({ userId, userCardId: c.id, reason, meta: { cardId: c.cardId } })));
  await changeBalance(tx, userId, 'dust', dust, { reason, meta: { copies: copies.length } });
  return dust;
}

/**
 * Dusts copies the player picked one by one (GDD §9). All-or-nothing: an unknown, already
 * used or account-bound copy rejects the whole request.
 */
export async function dustCopies(
  ctx: EconomyCtx,
  userId: string,
  ids: readonly string[],
): Promise<DustResponse> {
  const now = ctx.now();
  const unique = [...new Set(ids)];
  return ctx.db.transaction(async (tx) => {
    await lockWallet(tx, userId, now);
    const copies = await liveCopies(tx, userId, unique);
    if (copies.length !== unique.length) {
      throw new HttpError(404, 'notFound', 'Some of these copies are not yours or are gone.');
    }
    if (!copies.every(canDust)) {
      throw new HttpError(400, 'cannotDust', 'Starter copies cannot be dusted.');
    }
    const dust = await dustInTx(tx, userId, copies, 'dust', now);
    const wallet = await lockWallet(tx, userId, now);
    return { dusted: copies.length, dust, wallet: toWallet(wallet) };
  });
}

/** What "Dust extras" would dust right now. */
export async function previewDustExtras(
  ctx: EconomyCtx,
  userId: string,
): Promise<DustExtrasPreview> {
  return ctx.db.transaction(async (tx) => {
    const copies = await liveCopies(tx, userId);
    const plan = planDustExtras(copies);
    const picked = new Set(plan.copyIds);
    return {
      copies: copies
        .filter((c) => picked.has(c.id))
        .map((c) => ({ userCardId: c.id, cardId: c.cardId, rarity: c.rarity, variant: c.variant })),
      dust: plan.dust,
    };
  });
}

/** "Dust extras": plain copies beyond 9 ★1-equivalents per card (GDD §9). */
export async function dustExtras(ctx: EconomyCtx, userId: string): Promise<DustResponse> {
  const now = ctx.now();
  return ctx.db.transaction(async (tx) => {
    await lockWallet(tx, userId, now);
    const copies = await liveCopies(tx, userId);
    const picked = new Set(planDustExtras(copies).copyIds);
    const chosen = copies.filter((c) => picked.has(c.id));
    const dust = await dustInTx(tx, userId, chosen, 'dustExtras', now);
    const wallet = await lockWallet(tx, userId, now);
    return { dusted: chosen.length, dust, wallet: toWallet(wallet) };
  });
}
