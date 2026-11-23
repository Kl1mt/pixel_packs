import type { SoundDef, Voice } from './engine.js';

/** Hz of a MIDI note. */
const n = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A soft bell: sine + quiet octave, fast fall. */
const bell = (midi: number, at: number, decay: number, gain = 1): Voice[] => [
  { wave: 'sine', from: n(midi), at, decay, curve: 3, gain },
  { wave: 'sine', from: n(midi + 12), at, decay: decay * 0.5, curve: 4, gain: gain * 0.3 },
];

/** Tiny high twinkles scattered after `at` (pseudo-random but fixed). */
const twinkles = (at: number, count: number, spread: number, gain = 0.25): Voice[] =>
  Array.from({ length: count }, (_, i) => ({
    wave: 'sine' as const,
    from: n(96 + ((i * 7) % 12)),
    at: at + ((i * 0.618) % 1) * spread,
    decay: 0.12,
    curve: 3,
    gain,
  }));

/**
 * The M1 SFX set (GDD §20), one entry per sprite key. Cozy chiptune: soft squares
 * through a lo-pass, bells for good news, filtered noise for paper and air.
 */
export const SOUNDS: Record<string, SoundDef> = {
  'open.tear': {
    peak: 0.7,
    seed: 7,
    voices: [
      { wave: 'noise', from: 9000, to: 1800, attack: 0.01, hold: 0.12, decay: 0.28, crackle: 0.8 },
      { wave: 'noise', from: 3000, to: 900, at: 0.05, decay: 0.3, crackle: 0.9, gain: 0.5 },
      { wave: 'sine', from: 520, to: 180, at: 0.36, decay: 0.07, gain: 0.8 },
    ],
  },
  'open.slide': {
    peak: 0.4,
    seed: 3,
    voices: [{ wave: 'noise', from: 1400, to: 4200, attack: 0.04, decay: 0.16, curve: 2 }],
  },
  'open.flip': {
    peak: 0.5,
    seed: 5,
    voices: [
      { wave: 'noise', from: 6000, attack: 0.001, decay: 0.04, highpass: 1500, lowpass: 7000 },
      {
        wave: 'square',
        duty: 0.25,
        from: n(81),
        to: n(76),
        decay: 0.035,
        lowpass: 3000,
        gain: 0.3,
      },
    ],
  },
  'rarity.common': {
    peak: 0.35,
    voices: [{ wave: 'triangle', from: n(84), to: n(79), decay: 0.06, curve: 2 }],
  },
  'rarity.uncommon': {
    peak: 0.45,
    voices: bell(88, 0, 0.55),
  },
  'rarity.rare': {
    peak: 0.5,
    voices: [
      { wave: 'square', duty: 0.25, from: n(88), decay: 0.12, lowpass: 3500, gain: 0.5 },
      {
        wave: 'square',
        duty: 0.25,
        from: n(95),
        at: 0.1,
        decay: 0.45,
        curve: 2,
        lowpass: 3500,
        vibrato: [0.01, 7],
        gain: 0.5,
      },
      ...bell(95, 0.1, 0.6, 0.6),
    ],
  },
  'rarity.epic': {
    peak: 0.6,
    voices: [
      {
        wave: 'square',
        duty: 0.25,
        from: n(72),
        steps: [1, 1.26, 1.5, 2, 2.52, 3],
        stepEvery: 0.055,
        hold: 0.33,
        decay: 0.05,
        lowpass: 3800,
        gain: 0.45,
      },
      ...bell(84, 0.36, 1.0),
      ...bell(88, 0.36, 0.9, 0.6),
      ...bell(91, 0.36, 0.8, 0.5),
      ...twinkles(0.4, 6, 0.6),
    ],
  },
  'rarity.legendary': {
    peak: 0.7,
    seed: 11,
    voices: [
      { wave: 'noise', from: 600, to: 7000, attack: 0.35, decay: 0.12, gain: 0.35 },
      { wave: 'triangle', from: n(48), at: 0.4, decay: 1.2, curve: 2, gain: 0.6 },
      ...bell(84, 0.4, 1.6),
      ...bell(88, 0.42, 1.5, 0.8),
      ...bell(91, 0.44, 1.4, 0.7),
      ...bell(96, 0.46, 1.3, 0.6),
      ...twinkles(0.5, 10, 1.2),
    ],
  },
  'rarity.mythic': {
    peak: 0.75,
    seed: 13,
    voices: [
      { wave: 'triangle', from: n(33), to: n(45), attack: 0.6, decay: 1.6, curve: 2, gain: 0.7 },
      { wave: 'noise', from: 300, to: 5000, attack: 0.6, decay: 0.2, gain: 0.25 },
      {
        wave: 'square',
        duty: 0.125,
        from: n(69),
        at: 0.6,
        decay: 1.8,
        curve: 2,
        lowpass: 2200,
        vibrato: [0.006, 5],
        gain: 0.25,
      },
      ...bell(81, 0.62, 2.0),
      ...bell(85, 0.64, 1.9, 0.8),
      ...bell(88, 0.66, 1.8, 0.7),
      ...bell(95, 0.7, 1.6, 0.6),
      ...twinkles(0.7, 16, 1.6),
    ],
  },
  'variant.foil': {
    peak: 0.45,
    voices: [
      { wave: 'sine', from: 2000, to: 6500, attack: 0.02, decay: 0.16, gain: 0.6 },
      ...twinkles(0.08, 5, 0.3, 0.5),
    ],
  },
  'variant.prismatic': {
    peak: 0.55,
    voices: [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98].flatMap((m, i) =>
      bell(m, i * 0.055, 0.5, 0.7),
    ),
  },
  'variant.void': {
    peak: 0.45,
    seed: 17,
    voices: [
      { wave: 'noise', from: 6000, to: 200, attack: 0.05, decay: 0.6, gain: 0.5 },
      { wave: 'sine', from: 420, to: 45, attack: 0.02, decay: 0.75, curve: 1.5 },
      { wave: 'sine', from: 90, to: 38, at: 0.72, decay: 0.25, curve: 2 },
    ],
  },
  'variant.glitch': {
    peak: 0.25,
    seed: 19,
    voices: [
      {
        wave: 'square',
        from: n(76),
        steps: [1, 2.3, 0.6, 3.1, 1.4, 0.4, 2.7, 1.9, 0.8, 3.6, 1.1, 2.2],
        stepEvery: 0.03,
        hold: 0.34,
        decay: 0.04,
        crush: 4000,
        lowpass: 4000,
      },
      { wave: 'noise', from: 8000, at: 0.12, hold: 0.06, decay: 0.03, crush: 2500, gain: 0.4 },
      { wave: 'noise', from: 8000, at: 0.28, hold: 0.04, decay: 0.03, crush: 1800, gain: 0.4 },
    ],
  },
  'ui.hover': {
    peak: 0.12,
    voices: [{ wave: 'triangle', from: n(91), decay: 0.025, curve: 2 }],
  },
  'ui.press': {
    peak: 0.35,
    seed: 23,
    voices: [
      { wave: 'triangle', from: n(64), to: n(57), decay: 0.06, curve: 2 },
      { wave: 'noise', from: 2500, decay: 0.02, lowpass: 2500, gain: 0.5 },
    ],
  },
  'reward.coin': {
    peak: 0.28,
    voices: [
      { wave: 'square', duty: 0.5, from: n(83), hold: 0.06, decay: 0.01, lowpass: 4000 },
      { wave: 'square', duty: 0.5, from: n(88), at: 0.07, decay: 0.35, curve: 2, lowpass: 4000 },
    ],
  },
  'reward.gem': {
    peak: 0.45,
    voices: [...bell(96, 0, 0.45), ...bell(103, 0.05, 0.35, 0.6)],
  },
  'reward.dust': {
    peak: 0.4,
    seed: 29,
    voices: [
      {
        wave: 'noise',
        from: 3000,
        to: 9000,
        attack: 0.12,
        decay: 0.38,
        vibrato: [0.4, 9],
        gain: 0.6,
      },
      ...twinkles(0.05, 6, 0.4, 0.5),
    ],
  },
  'reward.fusion': {
    peak: 0.6,
    voices: [
      {
        wave: 'square',
        duty: 0.25,
        from: n(55),
        to: n(79),
        attack: 0.05,
        hold: 0.55,
        decay: 0.08,
        lowpass: 2600,
        vibrato: [0.03, 11],
        gain: 0.4,
      },
      { wave: 'noise', from: 800, to: 6000, attack: 0.5, decay: 0.15, gain: 0.25 },
      ...bell(84, 0.66, 1.0),
      ...bell(91, 0.68, 0.9, 0.6),
      ...twinkles(0.7, 6, 0.5),
    ],
  },
  'ui.error': {
    peak: 0.18,
    voices: [
      { wave: 'square', duty: 0.5, from: n(57), hold: 0.07, decay: 0.03, lowpass: 1200 },
      { wave: 'square', duty: 0.5, from: n(52), at: 0.12, hold: 0.1, decay: 0.08, lowpass: 1200 },
    ],
  },
};
