import type { CollectionCopy } from '../api/collection.js';
import type { Card, Stars } from '../model/card.js';
import { rarityRank, variantRank, type Rarity, type Realm, type Variant } from '../model/enums.js';
import { MAX_EQUIVALENTS, dustValue, starEquivalents } from './dust.js';

/** Pockets per binder page (a classic 3 × 3 sleeve, GDD §12). */
export const BINDER_PAGE_SIZE = 9;

/** Live copies grouped per card id. */
export function stacksByCard(copies: readonly CollectionCopy[]): Map<string, CollectionCopy[]> {
  const stacks = new Map<string, CollectionCopy[]>();
  for (const copy of copies) {
    const list = stacks.get(copy.cardId);
    if (list) list.push(copy);
    else stacks.set(copy.cardId, [copy]);
  }
  for (const list of stacks.values()) list.sort(compareCopies);
  return stacks;
}

/**
 * Best copy first: higher variant, then more stars, then a First-Edition stamp
 * (earliest season), then the lower mint number, then the older copy.
 */
export function compareCopies(a: CollectionCopy, b: CollectionCopy): number {
  return (
    variantRank(b.variant) - variantRank(a.variant) ||
    b.stars - a.stars ||
    (a.edition?.season ?? Infinity) - (b.edition?.season ?? Infinity) ||
    (a.mintNumber ?? Infinity) - (b.mintNumber ?? Infinity) ||
    a.acquiredAt.localeCompare(b.acquiredAt) ||
    a.userCardId.localeCompare(b.userCardId)
  );
}

/** ★1-equivalents of a stack (GDD §9; a card is maxed at 9). */
export function stackEquivalents(copies: readonly CollectionCopy[]): number {
  return copies.reduce((sum, c) => sum + starEquivalents(c.stars), 0);
}

export const isMaxed = (copies: readonly CollectionCopy[]) =>
  stackEquivalents(copies) >= MAX_EQUIVALENTS;

export type OwnedFilter = 'all' | 'owned' | 'missing';
export type BinderSort = 'number' | 'rarity' | 'name' | 'count' | 'newest';
export const BINDER_SORTS: readonly BinderSort[] = ['number', 'rarity', 'name', 'count', 'newest'];

/** Binder filters (GDD §12). Copy filters keep a card when *any* of its copies matches. */
export interface BinderFilter {
  rarity: Rarity | 'all';
  variant: Variant | 'all';
  /** At least this many stars. */
  stars: Stars | 'all';
  owned: OwnedFilter;
  edition: boolean;
  minted: boolean;
}

export const DEFAULT_BINDER_FILTER: BinderFilter = {
  rarity: 'all',
  variant: 'all',
  stars: 'all',
  owned: 'all',
  edition: false,
  minted: false,
};

export function isFiltered(f: BinderFilter): boolean {
  return (Object.keys(f) as (keyof BinderFilter)[]).some((k) => f[k] !== DEFAULT_BINDER_FILTER[k]);
}

function copyMatches(c: CollectionCopy, f: BinderFilter): boolean {
  return (
    (f.variant === 'all' || c.variant === f.variant) &&
    (f.stars === 'all' || c.stars >= f.stars) &&
    (!f.edition || c.edition !== null) &&
    (!f.minted || c.mintNumber !== null)
  );
}

const needsCopy = (f: BinderFilter) =>
  f.owned === 'owned' || f.variant !== 'all' || f.stars !== 'all' || f.edition || f.minted;

/** One binder pocket: a catalog card and the player's copies of it (best first; empty = silhouette). */
export interface BinderSlot {
  card: Card;
  copies: readonly CollectionCopy[];
}

const newestOf = (copies: readonly CollectionCopy[]) =>
  copies.reduce((max, c) => (c.acquiredAt > max ? c.acquiredAt : max), '');

const SORTS: Record<BinderSort, (a: BinderSlot, b: BinderSlot) => number> = {
  number: () => 0,
  rarity: (a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity),
  name: (a, b) => a.card.name.localeCompare(b.card.name, 'en'),
  count: (a, b) => b.copies.length - a.copies.length,
  newest: (a, b) => newestOf(b.copies).localeCompare(newestOf(a.copies)),
};

/** The pockets of one realm, filtered and sorted (ties keep the card number order). */
export function binderSlots(
  catalog: readonly Card[],
  realm: Realm,
  stacks: ReadonlyMap<string, readonly CollectionCopy[]>,
  filter: BinderFilter = DEFAULT_BINDER_FILTER,
  sort: BinderSort = 'number',
): BinderSlot[] {
  return catalog
    .filter((card) => card.realm === realm)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((card) => ({ card, copies: stacks.get(card.id) ?? [] }))
    .filter(({ card, copies }) => {
      if (filter.rarity !== 'all' && card.rarity !== filter.rarity) return false;
      if (filter.owned === 'missing') return copies.length === 0 && !needsCopy(filter);
      if (!needsCopy(filter)) return true;
      return copies.some((c) => copyMatches(c, filter));
    })
    .sort((a, b) => SORTS[sort](a, b) || a.card.id.localeCompare(b.card.id));
}

/** Splits pockets into pages of `size`. Always at least one (possibly empty) page. */
export function binderPages<T>(slots: readonly T[], size = BINDER_PAGE_SIZE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < slots.length; i += size) pages.push(slots.slice(i, i + size));
  return pages.length ? pages : [[]];
}

/** Completion of a realm: distinct cards owned out of the realm's cards. */
export function realmCompletion(
  catalog: readonly Card[],
  realm: Realm,
  stacks: ReadonlyMap<string, readonly CollectionCopy[]>,
): { owned: number; total: number } {
  const cards = catalog.filter((c) => c.realm === realm);
  return {
    owned: cards.filter((c) => (stacks.get(c.id)?.length ?? 0) > 0).length,
    total: cards.length,
  };
}

/** Why dusting a selection needs a second look (GDD §9: variants, stamps and mint numbers are never lost by accident). */
export type DustWarning = 'variant' | 'mint' | 'edition' | 'stars' | 'lastCopy';

export interface DustCheck {
  /** Selected copies that can never be dusted (account-bound starters). */
  blocked: string[];
  /** Warnings, in a stable order; empty means a plain dust. */
  warnings: DustWarning[];
  /** Stardust the dustable part of the selection pays. */
  dust: number;
  dustable: string[];
}

/**
 * Safety check before dusting `selected` copies of `card` out of `stack` (all of the
 * player's copies of it). The server re-checks; this decides what the confirm dialog says.
 */
export function checkDust(
  card: Pick<Card, 'rarity'>,
  stack: readonly CollectionCopy[],
  selectedIds: ReadonlySet<string>,
): DustCheck {
  const selected = stack.filter((c) => selectedIds.has(c.userCardId));
  const blocked = selected.filter((c) => c.accountBound).map((c) => c.userCardId);
  const ok = selected.filter((c) => !c.accountBound);
  const has = (p: (c: CollectionCopy) => boolean) => ok.some(p);
  const warnings: DustWarning[] = [];
  if (has((c) => c.variant !== 'normal')) warnings.push('variant');
  if (has((c) => c.mintNumber !== null)) warnings.push('mint');
  if (has((c) => c.edition !== null)) warnings.push('edition');
  if (has((c) => c.stars > 1)) warnings.push('stars');
  if (ok.length > 0 && ok.length === stack.length) warnings.push('lastCopy');
  return {
    blocked,
    warnings,
    dust: ok.reduce((sum, c) => sum + dustValue(card.rarity, c.variant, c.stars), 0),
    dustable: ok.map((c) => c.userCardId),
  };
}
