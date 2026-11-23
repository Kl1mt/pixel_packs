import { useEffect, useState, type RefObject } from 'react';
import {
  CARD_CATALOG,
  REALMS,
  binderPages,
  binderSlots,
  type BinderFilter,
  type BinderSlot,
  type BinderSort,
  type CollectionCopy,
  type Realm,
} from '@pixel-packs/shared';

/** Realms that have cards in the catalog (M1: Mossgrove and Starhollow), in display order. */
export const BINDER_REALMS: readonly Realm[] = REALMS.filter((r) =>
  CARD_CATALOG.some((c) => c.realm === r),
);

/** Width of the element, kept up to date (0 until measured). */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [ref]);
  return width;
}

/** Binder layout for a container width: two pages side by side, and the card scale (UI scale or 1×). */
export function bookLayout(width: number): { pagesPerSpread: 1 | 2; cardScale: 1 | 2 } {
  return { pagesPerSpread: width >= 1290 ? 2 : 1, cardScale: width >= 640 || width === 0 ? 2 : 1 };
}

export interface Spread {
  realm: Realm;
  /** 1-based page numbers within the realm. */
  first: number;
  realmPages: number;
  pages: BinderSlot[][];
}

/**
 * The book as a list of spreads. Each realm starts on a fresh spread, so the realm tabs
 * jump to a left page; only the open spread is ever rendered (the virtualised grid, §12).
 */
export function bookSpreads(
  stacks: ReadonlyMap<string, readonly CollectionCopy[]>,
  filter: BinderFilter,
  sort: BinderSort,
  pagesPerSpread: number,
): Spread[] {
  return BINDER_REALMS.flatMap((realm) => {
    const pages = binderPages(binderSlots(CARD_CATALOG, realm, stacks, filter, sort));
    const spreads: Spread[] = [];
    for (let i = 0; i < pages.length; i += pagesPerSpread)
      spreads.push({
        realm,
        first: i + 1,
        realmPages: pages.length,
        pages: pages.slice(i, i + pagesPerSpread),
      });
    return spreads;
  });
}
