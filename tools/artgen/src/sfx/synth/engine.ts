/**
 * A tiny offline "sfxr-style" synth (GDD §20, §29 T14): PixelLab audio needs a
 * higher plan, so the SFX are written as data and rendered here to WAV.
 * Deterministic: noise comes from a seeded generator.
 */

export const SAMPLE_RATE = 44100;

export type Wave = 'square' | 'triangle' | 'sine' | 'saw' | 'noise';

export interface Voice {
  wave: Wave;
  /** Start in seconds from the start of the sound. */
  at?: number;
  /** Pulse width for `square`, 0–1 (0.5 = square). */
  duty?: number;
  /** Start and end pitch in Hz (exponential glide); for noise, the filter centre. */
  from: number;
  to?: number;
  attack?: number;
  /** Time at full level before the decay. */
  hold?: number;
  decay: number;
  /** Decay curve: 1 linear, higher is a faster, bell-like fall. */
  curve?: number;
  gain?: number;
  /** Vibrato depth (fraction of pitch) and rate (Hz). */
  vibrato?: readonly [depth: number, rate: number];
  /** Pitch steps applied in order every `stepEvery` seconds (multipliers). */
  steps?: readonly number[];
  stepEvery?: number;
  /** One-pole lo-pass cut-off in Hz (softens squares; shapes noise). */
  lowpass?: number;
  /** One-pole hi-pass cut-off in Hz. */
  highpass?: number;
  /** Sample-and-hold rate in Hz for a bit-crushed sound. */
  crush?: number;
  /** Random amplitude flutter 0–1 (paper crackle). */
  crackle?: number;
}

export interface SoundDef {
  voices: readonly Voice[];
  /** Peak level after normalising, 0–1 (balances the set). */
  peak: number;
  seed?: number;
}

/** Mulberry32: small seeded PRNG so renders are byte-identical run to run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const voiceLength = (v: Voice) =>
  (v.at ?? 0) + (v.attack ?? 0.002) + (v.hold ?? 0) + v.decay;
export const soundLength = (d: SoundDef) => Math.max(...d.voices.map(voiceLength));

function envelope(v: Voice, t: number): number {
  const a = v.attack ?? 0.002;
  const h = v.hold ?? 0;
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + h) return 1;
  const d = (t - a - h) / v.decay;
  return d >= 1 ? 0 : (1 - d) ** (v.curve ?? 1);
}

const lpCoef = (hz: number) => 1 - Math.exp((-2 * Math.PI * hz) / SAMPLE_RATE);

function renderVoice(v: Voice, out: Float32Array, rand: () => number): void {
  const start = Math.round((v.at ?? 0) * SAMPLE_RATE);
  const len = Math.round(((v.attack ?? 0.002) + (v.hold ?? 0) + v.decay) * SAMPLE_RATE);
  const total = len / SAMPLE_RATE;
  const to = v.to ?? v.from;
  let phase = 0;
  let lp = 0;
  let hpIn = 0;
  let hpOut = 0;
  let held = 0;
  let holdPhase = 1;
  let flutter = 1;
  const lpk = v.lowpass ? lpCoef(v.lowpass) : 1;
  const hpk = v.highpass ? Math.exp((-2 * Math.PI * v.highpass) / SAMPLE_RATE) : 0;
  for (let i = 0; i < len && start + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    let f = v.from * (to / v.from) ** (t / total);
    if (v.steps && v.stepEvery) {
      const k = Math.min(v.steps.length - 1, Math.floor(t / v.stepEvery));
      f *= v.steps[k] ?? 1;
    }
    if (v.vibrato) f *= 1 + v.vibrato[0] * Math.sin(2 * Math.PI * v.vibrato[1] * t);
    phase = (phase + f / SAMPLE_RATE) % 1;
    let s: number;
    switch (v.wave) {
      case 'square':
        s = phase < (v.duty ?? 0.5) ? 1 : -1;
        break;
      case 'triangle':
        s = 4 * Math.abs(phase - 0.5) - 1;
        break;
      case 'sine':
        s = Math.sin(2 * Math.PI * phase);
        break;
      case 'saw':
        s = 2 * phase - 1;
        break;
      case 'noise':
        s = rand() * 2 - 1;
        break;
    }
    if (v.wave === 'noise' && !v.lowpass) {
      // Noise follows its pitch as a moving lo-pass, so sweeps sound like air.
      lp += lpCoef(Math.min(f, SAMPLE_RATE / 2.2)) * (s - lp);
      s = lp;
    } else if (v.lowpass) {
      lp += lpk * (s - lp);
      s = lp;
    }
    if (v.highpass) {
      hpOut = hpk * (hpOut + s - hpIn);
      hpIn = s;
      s = hpOut;
    }
    if (v.crush) {
      holdPhase += v.crush / SAMPLE_RATE;
      if (holdPhase >= 1) {
        holdPhase -= 1;
        held = s;
      }
      s = held;
    }
    if (v.crackle && i % 220 === 0) flutter = 1 - v.crackle * rand();
    out[start + i] = (out[start + i] ?? 0) + s * flutter * envelope(v, t) * (v.gain ?? 1);
  }
}

/** Renders a sound to mono samples, normalised to its `peak`. */
export function renderSound(d: SoundDef): Float32Array {
  const out = new Float32Array(Math.ceil(soundLength(d) * SAMPLE_RATE));
  const rand = rng(d.seed ?? 1);
  for (const v of d.voices) renderVoice(v, out, rand);
  let max = 0;
  for (const s of out) max = Math.max(max, Math.abs(s));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] = ((out[i] ?? 0) / max) * d.peak;
  return out;
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, rate = SAMPLE_RATE): Buffer {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => {
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2);
  });
  return b;
}
