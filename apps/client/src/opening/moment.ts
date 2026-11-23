import type { OpenedCard, Realm, Variant } from '@pixel-packs/shared';

/**
 * The big reveal moments (GDD §5, §6), a timeline of beats played over the spotlight
 * when a card flips. Legendary and Mythic cards get their own sequence, and every
 * special variant adds a stinger at the end. Commons to Epics without a variant play
 * nothing, so their flip stays quick.
 */
export type Beat =
  // Legendary: screen dims, golden god-rays, the card descends spinning (slow-mo), realm crest bursts.
  | 'dim'
  | 'rays'
  | 'descend'
  | 'crest'
  // Mythic: full-screen takeover, time-freeze, realm mini-cutscene, shockwave + camera shake.
  | 'takeover'
  | 'freeze'
  | 'cutscene'
  | 'shockwave'
  // Variant stingers.
  | 'foil'
  | 'prismatic'
  | 'void'
  | 'glitch';

export interface MomentPlan {
  beats: readonly { beat: Beat; ms: number }[];
  /** Realm of the card: picks the crest and the Mythic cutscene. */
  realm: Realm;
  /** Total length in ms. */
  ms: number;
}

const LEGENDARY: readonly [Beat, number][] = [
  ['dim', 350],
  ['rays', 650],
  ['descend', 1500],
  ['crest', 700],
];
const MYTHIC: readonly [Beat, number][] = [
  ['takeover', 450],
  ['freeze', 650],
  ['cutscene', 2200],
  ['shockwave', 700],
  ['descend', 900],
  ['crest', 600],
];
const STINGER: Record<Exclude<Variant, 'normal'>, number> = {
  foil: 750,
  prismatic: 1000,
  void: 1200,
  glitch: 1300,
};

/** Reduced effects: every beat is one still frame, held briefly (GDD §18). */
const REDUCED_MS: Partial<Record<Beat, number>> = { cutscene: 900, glitch: 700 };
const REDUCED_DEFAULT_MS = 450;
/** Beats with nothing to show as a still frame. */
const REDUCED_SKIP: ReadonlySet<Beat> = new Set([
  'dim',
  'takeover',
  'freeze',
  'descend',
  'shockwave',
]);

/** The moment of a flipped card, or null for a plain flip. */
export function momentPlan(
  card: Pick<OpenedCard, 'rarity' | 'variant' | 'realm'>,
  reduced: boolean,
): MomentPlan | null {
  const rarity: readonly [Beat, number][] =
    card.rarity === 'mythic' ? MYTHIC : card.rarity === 'legendary' ? LEGENDARY : [];
  const stinger: [Beat, number][] =
    card.variant === 'normal' ? [] : [[card.variant, STINGER[card.variant]]];
  const all = [...rarity, ...stinger];
  if (all.length === 0) return null;
  const beats = all
    .filter(([b]) => !reduced || !REDUCED_SKIP.has(b))
    .map(([beat, ms]) => ({ beat, ms: reduced ? (REDUCED_MS[beat] ?? REDUCED_DEFAULT_MS) : ms }));
  return { beats, realm: card.realm, ms: beats.reduce((s, b) => s + b.ms, 0) };
}

export interface BeatAt {
  beat: Beat;
  /** Progress through this beat, 0–1. */
  k: number;
  /** Index of the beat in the plan. */
  index: number;
}

/** Which beat plays `t` ms into the moment; null once it is over. */
export function beatAt(plan: MomentPlan, t: number): BeatAt | null {
  let start = 0;
  for (const [index, b] of plan.beats.entries()) {
    if (t < start + b.ms) return { beat: b.beat, k: Math.max(0, (t - start) / b.ms), index };
    start += b.ms;
  }
  return null;
}

/** Whether the card itself is on screen at a beat (it arrives with `descend`). */
export function cardShown(plan: MomentPlan, at: BeatAt | null): boolean {
  if (at === null) return true;
  const arrival = plan.beats.findIndex((b) => b.beat === 'descend');
  if (arrival === -1) {
    // No descent (reduced, or a stinger alone): it shows once the rarity beats are done.
    const firstStinger = plan.beats.findIndex((b) => STINGER_BEATS.has(b.beat));
    return firstStinger === -1 ? at.index >= plan.beats.length - 1 : at.index >= firstStinger;
  }
  return at.index >= arrival;
}

const STINGER_BEATS: ReadonlySet<Beat> = new Set(['foil', 'prismatic', 'void', 'glitch']);

/** The words the Glitch stinger corrupts the screen with (GDD §6). */
export const GLITCH_TEXT = 'ERR_LUCK_OVERFLOW';

/** What a screen reader hears while a moment plays. */
export function momentLabel(card: Pick<OpenedCard, 'rarity' | 'variant'>): string {
  const parts: string[] = [];
  if (card.rarity === 'legendary') parts.push('A Legendary card descends in golden light');
  if (card.rarity === 'mythic') parts.push('Time stops: a Mythic card');
  if (card.variant !== 'normal')
    parts.push(`${card.variant[0]?.toUpperCase() ?? ''}${card.variant.slice(1)} variant`);
  return `${parts.join('. ')}.`;
}
