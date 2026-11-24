import { describe, expect, it } from 'vitest';
import { RARITIES, VARIANTS } from '@pixel-packs/shared';
import { DEFAULT_SETTINGS } from '../settings/settings.js';
import {
  beatSounds,
  channelGain,
  crossedTearStep,
  flipSounds,
  moodLayers,
  sealSounds,
  tearStepSound,
  walletGainSounds,
} from './events.js';
import { SFX_SPRITE } from './sfxSprite.js';

const w = (gold: number, gems: number, dust: number) => ({ gold, gems, dust });

describe('audio events', () => {
  it('has a sprite entry for every rarity and special variant', () => {
    for (const r of RARITIES) expect(SFX_SPRITE).toHaveProperty([`rarity.${r}`]);
    for (const v of VARIANTS.filter((x) => x !== 'normal')) {
      expect(SFX_SPRITE).toHaveProperty([`variant.${v}`]);
    }
  });

  it('plays the flip and rarity stinger; Legendary/Mythic stingers wait for the crest', () => {
    expect(flipSounds({ rarity: 'common' })).toEqual([
      ['open.flip', 0],
      ['rarity.common', 90],
    ]);
    expect(flipSounds({ rarity: 'legendary' })).toEqual([['open.flip', 0]]);
  });

  it('gives every moment beat a sprite sound (or a deliberate silence)', () => {
    const beats = [
      'dim',
      'rays',
      'descend',
      'crest',
      'takeover',
      'freeze',
      'cutscene',
      'shockwave',
      'foil',
      'prismatic',
      'void',
      'glitch',
    ] as const;
    for (const b of beats) {
      for (const id of beatSounds(b, { rarity: 'mythic' })) expect(SFX_SPRITE).toHaveProperty([id]);
    }
    expect(beatSounds('crest', { rarity: 'legendary' })).toEqual(['rarity.legendary']);
    expect(beatSounds('void', { rarity: 'common' })).toEqual(['variant.void']);
    expect(beatSounds('cutscene', { rarity: 'mythic' })).toEqual([]);
  });

  it('clicks the clasp or rustles the vines at each quarter of the tear', () => {
    expect(tearStepSound({ id: 'starhollow', clasp: true })).toBe('open.clasp');
    expect(tearStepSound({ id: 'mossgrove', clasp: false })).toBe('open.rustle');
    expect(tearStepSound({ id: 'plain', clasp: false })).toBeNull();
    expect(crossedTearStep(0.2, 0.3)).toBe(true);
    expect(crossedTearStep(0.3, 0.4)).toBe(false);
    expect(crossedTearStep(0.8, 1)).toBe(false);
    expect(crossedTearStep(0.5, 0.4)).toBe(false);
    // The Mythic seal: the padlock clicks open, then the runes tick.
    expect(sealSounds(0.1, 0.2)).toEqual([]);
    expect(sealSounds(0.25, 0.32)).toEqual(['open.clasp']);
    expect(sealSounds(0.36, 0.4)).toEqual(['moment.tick']);
    expect(sealSounds(0.4, 0.45)).toEqual([]);
    expect(sealSounds(0.5, 0.4)).toEqual([]);
  });

  it('adds opening-music layers by pack mood', () => {
    expect(moodLayers('calm')).toEqual([]);
    expect(moodLayers('epic')).toEqual(['epic']);
    expect(moodLayers('golden')).toEqual(['epic', 'golden']);
    expect(moodLayers('mythic')).toEqual(['epic', 'golden']);
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
