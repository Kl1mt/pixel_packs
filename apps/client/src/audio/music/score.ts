/**
 * Chiptune music as data (GDD §20, §29 T14): a track is a loop of bars on a 16-step
 * grid; each part plays one instrument and belongs to a layer that can be faded in
 * and out (the opening's rarity layers). Pure, so it can be tested without audio.
 */

export type Instrument = 'lead' | 'arp' | 'bass' | 'bell' | 'kick' | 'hat';

/** One note on the 16-step grid of a bar: [step, MIDI note, length in steps]. */
export type Step = readonly [step: number, midi: number, len: number];

export interface Part {
  instrument: Instrument;
  /** `base` always plays; other layers are faded in by the player. */
  layer: string;
  /** One entry per bar; repeats if shorter than the track. */
  bars: readonly (readonly Step[])[];
}

export interface Track {
  id: string;
  bpm: number;
  bars: number;
  parts: readonly Part[];
}

export interface NoteEvent {
  /** In beats from the start of the loop (4 beats a bar, 4 steps a beat). */
  beat: number;
  /** In beats. */
  length: number;
  midi: number;
  instrument: Instrument;
  layer: string;
}

export const STEPS_PER_BAR = 16;
export const beatsPerLoop = (t: Track) => t.bars * 4;
export const secondsPerBeat = (t: Track) => 60 / t.bpm;
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Every note of one pass through the loop, sorted by time. */
export function loopEvents(t: Track): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (const part of t.parts) {
    if (part.bars.length === 0) continue;
    for (let bar = 0; bar < t.bars; bar++) {
      const steps = part.bars[bar % part.bars.length] ?? [];
      for (const [step, midi, len] of steps) {
        out.push({
          beat: bar * 4 + step / 4,
          length: len / 4,
          midi,
          instrument: part.instrument,
          layer: part.layer,
        });
      }
    }
  }
  return out.sort((a, b) => a.beat - b.beat);
}

/** Notes of an arpeggio: chord tones cycled every `every` steps for one bar. */
export function arpeggio(chord: readonly number[], every: number, len = every): Step[] {
  const out: Step[] = [];
  for (let s = 0, i = 0; s < STEPS_PER_BAR; s += every, i++) {
    out.push([s, chord[i % chord.length] ?? 0, len]);
  }
  return out;
}

/** A bar of the same drum hit on the given steps (midi is unused by drums). */
export const hits = (steps: readonly number[], len = 1): Step[] => steps.map((s) => [s, 0, len]);

/** Problems with a track's grid (notes outside a bar, overlong notes); empty when fine. */
export function validateTrack(t: Track): string[] {
  const issues: string[] = [];
  t.parts.forEach((p, pi) => {
    p.bars.forEach((bar, bi) => {
      for (const [step, , len] of bar) {
        if (step < 0 || step >= STEPS_PER_BAR || len <= 0 || step + len > STEPS_PER_BAR) {
          issues.push(`${t.id} part ${String(pi)} bar ${String(bi)} step ${String(step)}`);
        }
      }
    });
  });
  return issues;
}
