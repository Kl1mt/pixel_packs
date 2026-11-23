import type { Card, CollectionCopy, CopySource, Variant } from '@pixel-packs/shared';
import { editionText, mintText } from '../components/cardBadges.js';
import type { CardSpec } from '../render/cardView.js';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const variantName = (v: Variant) => (v === 'normal' ? 'Normal' : cap(v));

/** The card face for one copy (variant, stars, stamp, mint number). */
export function copySpec(card: Card, copy: CollectionCopy): CardSpec {
  return {
    card,
    variant: copy.variant,
    stars: copy.stars,
    edition: copy.edition,
    mintNumber: copy.mintNumber,
  };
}

const SOURCE: Record<CopySource, string> = {
  pack: 'from a pack',
  craft: 'crafted',
  fusion: 'fused',
  starter: 'starter card',
};

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const dateText = (iso: string) => DATE.format(new Date(iso));

/** "Void #12 · ★2 · 1st S1" — the traits that make a copy special (empty for a plain ★1). */
export function copyTraits(copy: CollectionCopy): string[] {
  return [
    copy.variant !== 'normal'
      ? variantName(copy.variant) + (copy.mintNumber ? ` ${mintText(copy.mintNumber)}` : '')
      : null,
    copy.stars > 1 ? '★'.repeat(copy.stars) : null,
    copy.edition ? editionText(copy.edition) : null,
  ].filter((t): t is string => t !== null);
}

/** One line per copy for the stack list. */
export function copyLine(copy: CollectionCopy): string {
  const traits = copyTraits(copy);
  return [
    traits.length ? traits.join(' · ') : 'Normal',
    SOURCE[copy.source],
    dateText(copy.acquiredAt),
  ].join(' · ');
}
