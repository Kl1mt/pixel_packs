import { describe, expect, it } from 'vitest';
import { RARITIES, VARIANTS } from '@pixel-packs/shared';
import { DEFAULT_SETTINGS } from '../settings/settings.js';
import { channelGain, flipSounds, moodLayers, walletGainSounds } from './events.js';
import { SFX_SPRITE } from './sfxSprite.js';

const w = (gold: number, gems: number, dust: number) => ({ gold, gems, dust });

describe('audio events', () => {
  it('has a sprite entry for every rarity and special variant', () => {
    for (const r of RARITIES) expect(SFX_SPRITE).toHaveProperty([`rarity.${r}`]);
    for (const v of VARIANTS.filter((x) => x !== 'normal')) {
      expect(SFX_SPRITE).toHaveProperty([`variant.${v}`]);
    }
  });

  it('plays the flip, then the rarity stinger, then the variant stinger', () => {
    expect(flipSounds({ rarity: 'common', variant: 'normal' })).toEqual([
      ['open.flip', 0],
      ['rarity.common', 90],
    ]);
    const epicVoid = flipSounds({ rarity: 'epic', variant: 'void' }).map(([id]) => id);
    expect(epicVoid).toEqual(['open.flip', 'rarity.epic', 'variant.void']);
  });

  it('adds opening-music layers by pack mood', () => {
    expect(moodLayers('calm')).toEqual([]);
    expect(moodLayers('epic')).toEqual(['epic']);
    expect(moodLayers('golden')).toEqual(['epic', 'golden']);
  });

  it('sounds only currencies that went up, never on first load', () => {
    expect(walletGainSounds(null, w(5, 5, 5))).toEqual([]);
    expect(walletGainSounds(w(5, 5, 5), w(4, 5, 5))).toEqual([]);
    expect(walletGainSounds(w(5, 5, 5), w(6, 6, 6))).toEqual([
      'reward.coin',
      'reward.gem',
      'reward.dust',
    ]);
  });

  it('mixes master × channel and silences everything when muted', () => {
    const s = { ...DEFAULT_SETTINGS, volume: { master: 0.5, music: 0.5, sfx: 1 } };
    expect(channelGain(s, 'music')).toBe(0.25);
    expect(channelGain(s, 'sfx')).toBe(0.5);
    expect(channelGain({ ...s, muted: true }, 'sfx')).toBe(0);
  });
});
