import type { OpenedCard, Rarity, Variant, Wallet } from '@pixel-packs/shared';
import type { Beat } from '../opening/moment.js';
import { UNLOCK_AT } from '../opening/mythicSeal.js';
import type { PackMood } from '../opening/reveal.js';
import type { Settings } from '../settings/settings.js';
import type { SfxId } from './sfxSprite.js';

/** Pure mapping from game events to sounds (GDD §20); the manager plays them. */

export const raritySting = (r: Rarity): SfxId => `rarity.${r}`;

export const variantSting = (v: Variant): SfxId | null => (v === 'normal' ? null : `variant.${v}`);

const HAS_MOMENT_STING: ReadonlySet<Rarity> = new Set(['legendary', 'mythic']);

/**
 * A flip: the card snap, then the rarity stinger (Commons only tick). Legendary and
 * Mythic stingers wait for their moment's crest, and variant stingers for their
 * moment beat (`beatSounds`). Each entry is [sound, delay ms after the flip].
 */
export function flipSounds(card: Pick<OpenedCard, 'rarity'>): [SfxId, number][] {
  const out: [SfxId, number][] = [['open.flip', 0]];
  if (!HAS_MOMENT_STING.has(card.rarity)) out.push([raritySting(card.rarity), 90]);
  return out;
}

/** Sounds of a reveal-moment beat (T13 timeline, `opening/moment.ts`). */
export function beatSounds(beat: Beat, card: Pick<OpenedCard, 'rarity'>): SfxId[] {
  switch (beat) {
    case 'dim':
    case 'takeover':
      return ['moment.swell'];
    case 'rays':
      return ['moment.rays'];
    case 'descend':
      return ['moment.whoosh'];
    case 'freeze':
      return ['moment.tick'];
    case 'shockwave':
      return ['moment.boom'];
    case 'crest':
      return [raritySting(card.rarity)];
    case 'cutscene':
      return [];
    default:
      return [`variant.${beat}`];
  }
}

/** The tear's step sound: the moon clasp clicks (Starhollow), vines rustle (Mossgrove). */
export function tearStepSound(theme: { id: string; clasp: boolean }): SfxId | null {
  if (theme.clasp) return 'open.clasp';
  return theme.id === 'mossgrove' ? 'open.rustle' : null;
}

/**
 * The Mythic seal's sounds as its seam tears (T21): the padlock clicks open at
 * `UNLOCK_AT`, then each eighth of the tear past it ticks as more runes light.
 */
export function sealSounds(prev: number, next: number): SfxId[] {
  if (next <= prev) return [];
  if (prev < UNLOCK_AT && next >= UNLOCK_AT) return ['open.clasp'];
  return next > UNLOCK_AT && crossedTearStep(prev, next, 8) ? ['moment.tick'] : [];
}

/** True when tear progress crosses one of `steps` evenly spaced marks (not the end). */
export function crossedTearStep(prev: number, next: number, steps = 4): boolean {
  if (next <= prev) return false;
  const a = Math.floor(prev * steps);
  const b = Math.floor(Math.min(next, 0.999) * steps);
  return b > a;
}

/** Opening-music layers for the pack's best rarity: Epic adds sparkle, Legendary+ bells. */
export function moodLayers(mood: PackMood): string[] {
  if (mood === 'golden' || mood === 'mythic') return ['epic', 'golden'];
  return mood === 'epic' ? ['epic'] : [];
}

/** The currencies that went up between two wallets, as their gain sounds. */
export function walletGainSounds(prev: Wallet | null, next: Wallet | null): SfxId[] {
  if (!prev || !next) return [];
  const out: SfxId[] = [];
  if (next.gold > prev.gold) out.push('reward.coin');
  if (next.gems > prev.gems) out.push('reward.gem');
  if (next.dust > prev.dust) out.push('reward.dust');
  return out;
}

export type Channel = 'music' | 'sfx';

/** Final gain of a channel: master × channel, or 0 when muted. */
export function channelGain(s: Settings, channel: Channel): number {
  if (s.muted) return 0;
  return s.volume.master * s.volume[channel];
}
