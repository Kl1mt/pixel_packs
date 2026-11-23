import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import {
  FRESH_PITY,
  ONBOARDING_SCRIPTS,
  PackTypeIdSchema,
  editionStampFor,
  needsMintNumber,
  pityGroupOf,
  revealOrder,
  rollDevOverridePack,
  rollPack,
  rollScriptedPack,
  type OpenPackRequest,
  type OpenPackResponse,
  type OpenedCard,
  type PackOpening,
  type PackRoll,
  type PackType,
  type PullHistoryResponse,
} from '@pixel-packs/shared';
import {
  devOddsOverrides,
  ledger,
  packOpenings,
  packTypes,
  pityCounters,
  userCards,
  users,
} from '../db/schema.js';
import { HttpError } from '../http/errors.js';
import type { EconomyCtx } from './context.js';
import { currentSeason, lockWallet, takePack, type Tx } from './db.js';
import { createMintAllocator } from './mint.js';

type OpeningRow = typeof packOpenings.$inferSelect;

export function toPackOpening(row: OpeningRow): PackOpening {
  return {
    id: row.id,
    packTypeId: PackTypeIdSchema.parse(row.packTypeId),
    scripted: row.scripted,
    pityTrigger: row.pityTrigger,
    cards: row.cards,
    revealOrder: revealOrder(row.cards).map((c) => c.slot),
    createdAt: row.createdAt.toISOString(),
    revealedAt: row.revealedAt?.toISOString() ?? null,
  };
}

/** Scripted onboarding pack → dev override → normal roll. Updates onboarding and pity rows. */
async function rollFor(ctx: EconomyCtx, tx: Tx, userId: string, pack: PackType): Promise<PackRoll> {
  const group = pityGroupOf(pack);
  const [pityRow] = await tx
    .select()
    .from(pityCounters)
    .where(and(eq(pityCounters.userId, userId), eq(pityCounters.pityGroup, group)));
  const pity = pityRow
    ? {
        packsSinceLegendaryPlus: pityRow.packsSinceLegendaryPlus,
        packsSinceMythic: pityRow.packsSinceMythic,
      }
    : FRESH_PITY;

  const [user] = await tx
    .select({ step: users.onboardingStep })
    .from(users)
    .where(eq(users.id, userId))
    .for('update');
  const step = user?.step ?? ONBOARDING_SCRIPTS.length;
  if (pack.kind === 'realm' && step < ONBOARDING_SCRIPTS.length) {
    await tx
      .update(users)
      .set({ onboardingStep: step + 1 })
      .where(eq(users.id, userId));
    return rollScriptedPack(step, pack, pity, ctx.index, ctx.rng);
  }

  if (ctx.allowDevOverrides) {
    const [o] = await tx.select().from(devOddsOverrides).where(eq(devOddsOverrides.userId, userId));
    if (o && o.remaining > 0) {
      if (o.remaining === 1)
        await tx.delete(devOddsOverrides).where(eq(devOddsOverrides.userId, userId));
      else
        await tx
          .update(devOddsOverrides)
          .set({ remaining: o.remaining - 1 })
          .where(eq(devOddsOverrides.userId, userId));
      return rollDevOverridePack(pack, pity, ctx.index, ctx.rng, {
        ...(o.featuredRarity ? { rarity: o.featuredRarity } : {}),
        ...(o.featuredVariant ? { variant: o.featuredVariant } : {}),
      });
    }
  }

  const roll = rollPack(pack, pity, ctx.index, ctx.rng);
  await tx
    .insert(pityCounters)
    .values({ userId, pityGroup: group, ...roll.pity })
    .onConflictDoUpdate({ target: [pityCounters.userId, pityCounters.pityGroup], set: roll.pity });
  return roll;
}

/**
 * Opens one pack from the inventory in a single transaction (GDD §7, §21): roll, pity,
 * copies, mint numbers, ledger and the opening record. The result is stored before the
 * client animates it, and a repeated idempotency key returns the stored result.
 */
export async function openPack(
  ctx: EconomyCtx,
  userId: string,
  req: OpenPackRequest,
): Promise<OpenPackResponse> {
  const now = ctx.now();
  return ctx.db.transaction(async (tx) => {
    await lockWallet(tx, userId, now);
    const [previous] = await tx
      .select()
      .from(packOpenings)
      .where(
        and(eq(packOpenings.userId, userId), eq(packOpenings.idempotencyKey, req.idempotencyKey)),
      );
    if (previous) {
      if (previous.packTypeId !== req.packTypeId) {
        throw new HttpError(409, 'idempotencyConflict', 'This key was used for another pack.');
      }
      return { opening: toPackOpening(previous), replayed: true };
    }

    const [type] = await tx.select().from(packTypes).where(eq(packTypes.id, req.packTypeId));
    if (!type?.enabled) throw new HttpError(400, 'packDisabled', 'That pack is not available.');
    const openingId = randomUUID();
    if (!(await takePack(tx, userId, type.id, { reason: 'openPack', refId: openingId }))) {
      throw new HttpError(409, 'noPacks', 'You have no pack of this kind.');
    }
    const pack: PackType =
      type.kind === 'realm' && type.realm
        ? { kind: 'realm', realm: type.realm }
        : { kind: 'mythic' };
    const roll = await rollFor(ctx, tx, userId, pack);

    const edition = editionStampFor('pack', type.releaseSeason, await currentSeason(tx, now));
    const owned = await tx
      .selectDistinct({ cardId: userCards.cardId })
      .from(userCards)
      .where(
        and(
          eq(userCards.userId, userId),
          isNull(userCards.removedAt),
          inArray(
            userCards.cardId,
            roll.cards.map((c) => c.cardId),
          ),
        ),
      );
    const seen = new Set(owned.map((o) => o.cardId));
    // Mint rows are shared by all players: lock them in a fixed order so that two
    // concurrent pulls can never deadlock.
    const mint = createMintAllocator(tx);
    const mintNumbers = new Map<number, number>();
    const minted = roll.cards
      .filter((c) => needsMintNumber(c.variant))
      .sort(
        (a, b) =>
          `${a.cardId}:${a.variant}`.localeCompare(`${b.cardId}:${b.variant}`) || a.slot - b.slot,
      );
    for (const c of minted) mintNumbers.set(c.slot, await mint.next(c.cardId, c.variant));
    const cards: OpenedCard[] = roll.cards.map((c) => {
      const isNew = !seen.has(c.cardId);
      seen.add(c.cardId);
      const mintNumber = mintNumbers.get(c.slot) ?? null;
      return { ...c, userCardId: randomUUID(), mintNumber, edition, isNew };
    });

    const [row] = await tx
      .insert(packOpenings)
      .values({
        id: openingId,
        userId,
        packTypeId: type.id,
        idempotencyKey: req.idempotencyKey,
        scripted: roll.scripted,
        pityTrigger: roll.pityTrigger,
        mythicSoftPityBonus: roll.mythicSoftPityBonus,
        cards,
        createdAt: now,
      })
      .returning();
    if (!row) throw new Error('opening insert returned nothing');
    await tx.insert(userCards).values(
      cards.map((c) => ({
        id: c.userCardId,
        userId,
        cardId: c.cardId,
        variant: c.variant,
        editionSeason: c.edition?.season ?? null,
        mintNumber: c.mintNumber,
        source: 'pack' as const,
        packOpeningId: row.id,
        acquiredAt: now,
      })),
    );
    await tx.insert(ledger).values(
      cards.map((c) => ({
        userId,
        userCardId: c.userCardId,
        reason: 'pull',
        refId: row.id,
        meta: { cardId: c.cardId, variant: c.variant, mintNumber: c.mintNumber },
      })),
    );
    return { opening: toPackOpening(row), replayed: false };
  });
}

/** The latest opening whose reveal was never finished ("Resume reveal"). */
export async function pendingOpening(ctx: EconomyCtx, userId: string): Promise<PackOpening | null> {
  const [row] = await ctx.db
    .select()
    .from(packOpenings)
    .where(and(eq(packOpenings.userId, userId), isNull(packOpenings.revealedAt)))
    .orderBy(desc(packOpenings.createdAt))
    .limit(1);
  return row ? toPackOpening(row) : null;
}

/** Marks an opening as fully revealed. Idempotent. */
export async function markRevealed(
  ctx: EconomyCtx,
  userId: string,
  openingId: string,
): Promise<void> {
  const updated = await ctx.db
    .update(packOpenings)
    .set({ revealedAt: ctx.now() })
    .where(
      and(
        eq(packOpenings.id, openingId),
        eq(packOpenings.userId, userId),
        isNull(packOpenings.revealedAt),
      ),
    )
    .returning({ id: packOpenings.id });
  if (updated.length > 0) return;
  const [exists] = await ctx.db
    .select({ id: packOpenings.id })
    .from(packOpenings)
    .where(and(eq(packOpenings.id, openingId), eq(packOpenings.userId, userId)));
  if (!exists) throw new HttpError(404, 'notFound', 'No such opening.');
}

const CURSOR_RE = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)_([0-9a-f-]{36})$/;

/** Revealed openings, newest first, keyset-paged by (created_at, id). */
export async function pullHistory(
  ctx: EconomyCtx,
  userId: string,
  limit: number,
  cursor: string | undefined,
): Promise<PullHistoryResponse> {
  let after = undefined;
  if (cursor !== undefined) {
    const m = CURSOR_RE.exec(cursor);
    if (!m?.[1] || !m[2]) throw new HttpError(400, 'badRequest', 'Invalid cursor.');
    const at = new Date(m[1]);
    after = or(
      lt(packOpenings.createdAt, at),
      and(eq(packOpenings.createdAt, at), lt(packOpenings.id, m[2])),
    );
  }
  const rows = await ctx.db
    .select()
    .from(packOpenings)
    .where(and(eq(packOpenings.userId, userId), isNotNull(packOpenings.revealedAt), after))
    .orderBy(desc(packOpenings.createdAt), desc(packOpenings.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    openings: page.map(toPackOpening),
    nextCursor: rows.length > limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
  };
}
