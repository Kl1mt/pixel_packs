import { and, desc, eq, isNotNull, lt, or, sql } from 'drizzle-orm';
import {
  RARITIES,
  rarityRank,
  type PullHistoryFilter,
  type PullHistoryResponse,
} from '@pixel-packs/shared';
import { packOpenings } from '../db/schema.js';
import { HttpError } from '../http/errors.js';
import type { EconomyCtx } from './context.js';
import { toPackOpening } from './opening.js';

const CURSOR_RE = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)_([0-9a-f-]{36})$/;

/** Openings holding a card that matches `cond` (a SQL condition on the jsonb element `c`). */
const anyCard = (cond: ReturnType<typeof sql>) =>
  sql`exists (select 1 from jsonb_array_elements(${packOpenings.cards}) as c where ${cond})`;

function filterWhere(f: PullHistoryFilter) {
  const atLeast = f.minRarity ? RARITIES.slice(rarityRank(f.minRarity)) : null;
  return and(
    f.packTypeId ? eq(packOpenings.packTypeId, f.packTypeId) : undefined,
    atLeast
      ? anyCard(
          sql`c->>'rarity' in (${sql.join(
            atLeast.map((r) => sql`${r}`),
            sql`, `,
          )})`,
        )
      : undefined,
    f.variant ? anyCard(sql`c->>'variant' = ${f.variant}`) : undefined,
  );
}

/** Revealed openings, newest first, keyset-paged by (created_at, id), optionally filtered (GDD §12). */
export async function pullHistory(
  ctx: EconomyCtx,
  userId: string,
  limit: number,
  cursor: string | undefined,
  filter: PullHistoryFilter = {},
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
    .where(
      and(
        eq(packOpenings.userId, userId),
        isNotNull(packOpenings.revealedAt),
        after,
        filterWhere(filter),
      ),
    )
    .orderBy(desc(packOpenings.createdAt), desc(packOpenings.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    openings: page.map(toPackOpening),
    nextCursor: rows.length > limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
  };
}
