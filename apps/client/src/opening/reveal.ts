import {
  CARD_CATALOG,
  rarityRank,
  type Card,
  type OpenedCard,
  type PackOpening,
  type Rarity,
} from '@pixel-packs/shared';

/** Stages of one opening (GDD §7): tear the pack, flip the cards, read the results. */
export type OpeningPhase = 'tear' | 'reveal' | 'summary';

export interface RevealState {
  phase: OpeningPhase;
  /** Cards flipped so far, in reveal order. */
  flipped: number;
  /** "Reveal all" is flipping the rest on a timer. */
  auto: boolean;
}

export type RevealAction =
  | { type: 'torn' }
  | { type: 'flip' }
  | { type: 'revealAll' }
  | { type: 'skip' }
  | { type: 'results' };

const CARD_COUNT = 5;

/** A fresh opening starts at the tear; a resumed one at the card stack (the pack is already open). */
export function initialReveal(resumed: boolean): RevealState {
  return { phase: resumed ? 'reveal' : 'tear', flipped: 0, auto: false };
}

export function revealReducer(s: RevealState, a: RevealAction): RevealState {
  switch (a.type) {
    case 'torn':
      return s.phase === 'tear' ? { ...s, phase: 'reveal' } : s;
    case 'flip': {
      if (s.phase !== 'reveal' || s.flipped >= CARD_COUNT) return s;
      const flipped = s.flipped + 1;
      return { ...s, flipped, auto: s.auto && flipped < CARD_COUNT };
    }
    case 'revealAll':
      return s.phase === 'reveal' && s.flipped < CARD_COUNT ? { ...s, auto: true } : s;
    case 'skip':
    case 'results':
      return { phase: 'summary', flipped: CARD_COUNT, auto: false };
  }
}

/** The opening's cards in reveal order (ascending rarity, featured last — the server decides). */
export function revealSequence(o: PackOpening): OpenedCard[] {
  return o.revealOrder.flatMap((slot) => o.cards.filter((c) => c.slot === slot));
}

/** Glow on a card back before its flip (GDD §5): none for Commons. */
export type BackGlow = Exclude<Rarity, 'common'> | null;
export const backGlow = (c: Pick<OpenedCard, 'rarity'>): BackGlow =>
  c.rarity === 'common' ? null : c.rarity;

/** Best rarity in the pack: Epic or better makes the pack shake and leak light at the tear (gold for Legendary, rose-gold and harder for Mythic). */
export type PackMood = 'calm' | 'epic' | 'golden' | 'mythic';
export function packMood(o: PackOpening): PackMood {
  const best = Math.max(...o.cards.map((c) => rarityRank(c.rarity)));
  if (best >= rarityRank('mythic')) return 'mythic';
  if (best >= rarityRank('legendary')) return 'golden';
  if (best >= rarityRank('epic')) return 'epic';
  return 'calm';
}

export interface OpeningSummary {
  newCount: number;
  extraCount: number;
  /** Non-normal variants (they get the live shader in the summary). */
  specialCount: number;
}

export function summarize(o: PackOpening): OpeningSummary {
  return {
    newCount: o.cards.filter((c) => c.isNew).length,
    extraCount: o.cards.filter((c) => !c.isNew).length,
    specialCount: o.cards.filter((c) => c.variant !== 'normal').length,
  };
}

const BY_ID = new Map(CARD_CATALOG.map((c) => [c.id, c]));

/** The catalog card of a pulled copy (the client ships the same catalog as the server). */
export function catalogCard(id: string): Card {
  const card = BY_ID.get(id);
  if (!card) throw new Error(`Unknown card ${id}`);
  return card;
}

/** The face look of a pulled copy, for `Card` / `CardStage` (new pulls are ★1). */
export const openedSpec = (c: OpenedCard) => ({
  card: catalogCard(c.cardId),
  variant: c.variant,
  edition: c.edition,
  mintNumber: c.mintNumber,
});
