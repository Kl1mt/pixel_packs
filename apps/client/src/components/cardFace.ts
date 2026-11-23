import {
  CARD_ART_DROP,
  CARD_SCALE,
  CARD_FACE,
  MASTER_PALETTE,
  cardNameSize,
  cardRulesText,
  realmCrestPixels,
  starredCard,
  statDigitPixels,
  type Card,
  type EditionStamp,
  type Rarity,
  type Realm,
  type Stars,
  type Variant,
} from '@pixel-packs/shared';
import { cardBadgePixels, mintText, type FacePixel } from './cardBadges.js';

/** Rows of sky above the ground band in the 64-row art window (78 % of it, on a whole pixel). */
export const CARD_SKY_ROWS = 50;

/** Flat two-band backdrop behind the art (sky, ground), per realm (T06 style tile). */
const REALM_BACKDROP: Partial<Record<Realm, readonly [string, string]>> = {
  mossgrove: [MASTER_PALETTE.lichen, MASTER_PALETTE.sprout],
  starhollow: [MASTER_PALETTE.indigo, MASTER_PALETTE.night],
};
const DEFAULT_BACKDROP = [MASTER_PALETTE.cream, MASTER_PALETTE.straw] as const;

export interface CardFaceModel {
  id: string;
  name: string;
  rarity: Rarity;
  atk: number;
  hp: number;
  art: string;
  frame: string;
  /** Art px to move the art down so it stands on the window's bottom row. */
  artDrop: number;
  nameSize: number;
  rules: string[];
  backdrop: readonly [string, string];
  /** ATK and HP digits as ink pixels on the 96×128 face. */
  statPixels: { x: number; y: number }[];
  variant: Variant;
  stars: Stars;
  /** Realm crest in the frame's crest socket (T20), in palette colours. */
  crestPixels: FacePixel[];
  /** Star, edition and mint badges in palette colours, painted in order. */
  badgePixels: FacePixel[];
  label: string;
}

/** Per-copy look (GDD §4, §6); catalog values win where nothing is given. */
export interface CardFaceOverrides {
  rarity?: Rarity;
  atk?: number;
  hp?: number;
  variant?: Variant;
  stars?: Stars;
  edition?: EditionStamp | null;
  mintNumber?: number | null;
}

const VARIANT_LABEL: Record<Variant, string> = {
  normal: '',
  foil: 'Foil',
  prismatic: 'Prismatic',
  void: 'Void',
  glitch: 'Glitch',
};

function copyLabel(
  variant: Variant,
  stars: Stars,
  edition: EditionStamp | null,
  mint: number | null,
) {
  const parts = [
    VARIANT_LABEL[variant] + (mint !== null && VARIANT_LABEL[variant] ? ` ${mintText(mint)}` : ''),
    stars > 1 ? `${String(stars)} stars` : '',
    edition ? `First Edition, Season ${String(edition.season)}` : '',
  ].filter(Boolean);
  return parts.length ? `, ${parts.join(', ')}` : '';
}

/** Everything the DOM card needs, derived from the catalog card and shared `CARD_FACE`. */
export function cardFaceModel(card: Card, o: CardFaceOverrides = {}): CardFaceModel {
  const rarity = o.rarity ?? card.rarity;
  const variant = o.variant ?? 'normal';
  const stars = o.stars ?? 1;
  const edition = o.edition ?? null;
  const mintNumber = o.mintNumber ?? null;
  const played = starredCard(card, stars);
  const atk = o.atk ?? played.atk;
  const hp = o.hp ?? played.hp;
  const rules = cardRulesText(played);
  return {
    id: card.id,
    name: card.name,
    rarity,
    atk,
    hp,
    art: `/assets/cards/${card.id}.png`,
    frame: `/assets/frames/${rarity}.png`,
    artDrop: CARD_ART_DROP[card.id] ?? 0,
    nameSize: cardNameSize(card.name),
    rules,
    backdrop: REALM_BACKDROP[card.realm] ?? DEFAULT_BACKDROP,
    statPixels: [...statDigitPixels(atk, CARD_FACE.atk), ...statDigitPixels(hp, CARD_FACE.hp)],
    variant,
    stars,
    crestPixels: realmCrestPixels(card.realm),
    badgePixels: cardBadgePixels({ variant, stars, edition, mintNumber }),
    label: `${card.name}, ${rarity}${copyLabel(variant, stars, edition, mintNumber)}, attack ${String(
      atk,
    )}, health ${String(hp)}${rules.length ? `. ${rules.join(' ')}` : ''}`,
  };
}

/**
 * Face text at a card scale other than `CARD_SCALE` (binder thumbnails, T15): the name
 * shrinks with the card (and goes at 1×), and the compact rules only show at full size (inspect pairs
 * the card with `CardDetails` at body size).
 */
export function faceText(
  m: CardFaceModel,
  scale: number,
): { nameSize: number; name: boolean; rules: boolean } {
  if (scale >= CARD_SCALE) return { nameSize: m.nameSize, name: true, rules: true };
  const nameSize = Math.round((m.nameSize * scale) / CARD_SCALE);
  // Below ~11 px (1× thumbnails) the name is unreadable: the pocket's label carries it.
  return { nameSize, name: nameSize >= 11, rules: false };
}
