import {
  CARD_ART_DROP,
  CARD_FACE,
  MASTER_PALETTE,
  cardNameSize,
  cardRulesText,
  statDigitPixels,
  type Card,
  type Rarity,
  type Realm,
} from '@pixel-packs/shared';

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
  label: string;
}

export interface CardFaceOverrides {
  rarity?: Rarity;
  atk?: number;
  hp?: number;
}

/** Everything the DOM card needs, derived from the catalog card and shared `CARD_FACE`. */
export function cardFaceModel(card: Card, o: CardFaceOverrides = {}): CardFaceModel {
  const rarity = o.rarity ?? card.rarity;
  const atk = o.atk ?? card.atk;
  const hp = o.hp ?? card.hp;
  const rules = cardRulesText(card);
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
    label: `${card.name}, ${rarity}, attack ${String(atk)}, health ${String(hp)}${
      rules.length ? `. ${rules.join(' ')}` : ''
    }`,
  };
}
