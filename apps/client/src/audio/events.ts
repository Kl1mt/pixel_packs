import type { OpenedCard, Rarity, Variant, Wallet } from '@pixel-packs/shared';
import type { Settings } from '../settings/settings.js';
import type { SfxId } from './sfxSprite.js';

/** Pure mapping from game events to sounds (GDD §20); the manager plays them. */

export const raritySting = (r: Rarity): SfxId => `rarity.${r}`;

export const variantSting = (v: Variant): SfxId | null => (v === 'normal' ? null : `variant.${v}`);

/**
 * A flip: the card snap, then the rarity stinger (Commons only tick), then the
 * variant stinger on top. Each entry is [sound, delay ms after the flip].
 */
export function flipSounds(card: Pick<OpenedCard, 'rarity' | 'variant'>): [SfxId, number][] {
  const out: [SfxId, number][] = [
    ['open.flip', 0],
    [raritySting(card.rarity), 90],
  ];
  const v = variantSting(card.variant);
  if (v) out.push([v, 260]);
  return out;
}

/** Opening-music layers for the pack's best rarity: Epic adds sparkle, Legendary+ bells. */
export function moodLayers(mood: 'calm' | 'epic' | 'golden'): string[] {
  if (mood === 'golden') return ['epic', 'golden'];
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
