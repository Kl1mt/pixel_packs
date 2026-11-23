import {
  beatsPerLoop,
  loopEvents,
  midiToHz,
  secondsPerBeat,
  type Instrument,
  type NoteEvent,
  type Track,
} from './score.js';

const LOOKAHEAD_S = 0.25;
const TICK_MS = 60;
const FADE_S = 0.6;

/** Instrument loudness, balanced by ear against the SFX set. */
const LEVEL: Record<Instrument, number> = {
  lead: 0.09,
  arp: 0.035,
  bass: 0.2,
  bell: 0.07,
  kick: 0.28,
  hat: 0.025,
};

function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

/**
 * Plays one looping track at a time through `out`, with per-layer gains so the
 * opening's rarity layers can fade in. A lo-pass on the bus keeps squares soft.
 */
export class ChipSynth {
  private readonly bus: GainNode;
  private readonly waves: { lead: PeriodicWave; arp: PeriodicWave };
  private noise: AudioBuffer | null = null;
  private track: Track | null = null;
  private events: NoteEvent[] = [];
  private layers = new Map<string, GainNode>();
  private loopStart = 0;
  private cursor = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
  ) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    this.bus = ctx.createGain();
    this.bus.connect(filter).connect(out);
    this.waves = { lead: pulseWave(ctx, 0.25), arp: pulseWave(ctx, 0.125) };
  }

  get playing(): string | null {
    return this.track?.id ?? null;
  }

  /** Starts a track from its top (crossfading out the old one), with these layers on. */
  play(track: Track, layers: readonly string[] = []): void {
    this.stop();
    this.track = track;
    this.events = loopEvents(track);
    const now = this.ctx.currentTime;
    for (const id of new Set(track.parts.map((p) => p.layer))) {
      const g = this.ctx.createGain();
      g.gain.value = id === 'base' || layers.includes(id) ? 1 : 0;
      g.connect(this.bus);
      this.layers.set(id, g);
    }
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(0, now);
    this.bus.gain.linearRampToValueAtTime(1, now + FADE_S);
    this.loopStart = now + 0.05;
    this.cursor = 0;
    this.timer = setInterval(() => {
      this.schedule();
    }, TICK_MS);
    this.schedule();
  }

  /** Fades a layer in or out at once (e.g. when the pack's mood is known). */
  setLayer(id: string, on: boolean): void {
    const g = this.layers.get(id);
    if (!g) return;
    const now = this.ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(on ? 1 : 0, now + FADE_S);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    for (const g of this.layers.values()) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + 0.15);
      setTimeout(() => {
        g.disconnect();
      }, 400);
    }
    this.layers = new Map();
    this.track = null;
  }

  /** Schedules notes up to `until` (context time); offline renders call it once for the whole clip. */
  schedule(until = this.ctx.currentTime + LOOKAHEAD_S): void {
    const t = this.track;
    if (!t) return;
    const spb = secondsPerBeat(t);
    const loopBeats = beatsPerLoop(t);
    // Walk events in loop order; `cursor` counts events across loops.
    for (;;) {
      const loop = Math.floor(this.cursor / this.events.length);
      const ev = this.events[this.cursor % this.events.length];
      if (!ev) return;
      const at = this.loopStart + (loop * loopBeats + ev.beat) * spb;
      if (at > until) return;
      if (at >= this.ctx.currentTime - 0.02) this.note(ev, at, ev.length * spb);
      this.cursor++;
    }
  }

  private note(ev: NoteEvent, at: number, dur: number): void {
    const dest = this.layers.get(ev.layer);
    if (!dest) return;
    const { ctx } = this;
    const env = ctx.createGain();
    env.connect(dest);
    const peak = LEVEL[ev.instrument];
    const g = env.gain;
    g.setValueAtTime(0, at);
    let src: AudioScheduledSourceNode;
    let end = at + dur;
    switch (ev.instrument) {
      case 'kick': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(120, at);
        o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
        g.linearRampToValueAtTime(peak, at + 0.005);
        g.exponentialRampToValueAtTime(0.0001, at + 0.18);
        end = at + 0.2;
        src = o;
        break;
      }
      case 'hat': {
        const n = ctx.createBufferSource();
        n.buffer = this.noiseBuffer();
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        n.connect(hp).connect(env);
        g.linearRampToValueAtTime(peak, at + 0.002);
        g.exponentialRampToValueAtTime(0.0001, at + 0.04);
        n.start(at);
        n.stop(at + 0.05);
        return;
      }
      case 'bell': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = midiToHz(ev.midi);
        g.linearRampToValueAtTime(peak, at + 0.004);
        g.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, 1.2));
        end = at + Math.max(dur, 1.2);
        src = o;
        break;
      }
      default: {
        const o = ctx.createOscillator();
        if (ev.instrument === 'bass') o.type = 'triangle';
        else o.setPeriodicWave(ev.instrument === 'lead' ? this.waves.lead : this.waves.arp);
        o.frequency.value = midiToHz(ev.midi);
        const release = ev.instrument === 'arp' ? 0.04 : 0.08;
        g.linearRampToValueAtTime(peak, at + 0.008);
        g.linearRampToValueAtTime(peak * 0.7, at + 0.08);
        g.setValueAtTime(peak * 0.7, Math.max(at + 0.08, end - release));
        g.linearRampToValueAtTime(0, end);
        src = o;
      }
    }
    if (src instanceof OscillatorNode) src.connect(env);
    src.start(at);
    src.stop(end + 0.02);
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.1), this.ctx.sampleRate);
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = b;
    return b;
  }
}
