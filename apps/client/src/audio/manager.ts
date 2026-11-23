import { Howl, Howler } from 'howler';
import type { Wallet } from '@pixel-packs/shared';
import type { Settings } from '../settings/settings.js';
import { channelGain, walletGainSounds } from './events.js';
import { ChipSynth } from './music/synth.js';
import { TRACKS, type TrackId } from './music/tracks.js';
import { SFX_SPRITE, type SfxId } from './sfxSprite.js';

interface Store<T> {
  get(): T;
  subscribe(cb: () => void): () => void;
}

interface MusicRequest {
  track: TrackId;
  layers: string[];
}

/** Throttle per sound so hovering along a row of buttons does not machine-gun. */
const MIN_GAP_MS: Partial<Record<SfxId, number>> = { 'ui.hover': 70, 'open.flip': 40 };
const LOG_SIZE = 50;

/**
 * The app's audio (GDD §20): one Howler sprite for all SFX, the chiptune synth for
 * music, master/music/SFX volumes and mute from the settings store. Nothing is
 * created before the first pointer or key press (browser autoplay rules); sounds
 * asked for before that are dropped, and the wanted music starts on unlock.
 */
export function createAudioManager(settings: Store<Settings>, base = '/assets/audio/') {
  let sfx: Howl | null = null;
  let synth: ChipSynth | null = null;
  let musicGain: GainNode | null = null;
  const music: MusicRequest[] = [{ track: 'home', layers: [] }];
  const lastPlayed = new Map<SfxId, number>();
  /** Recent sounds, newest last (read by the e2e checks). */
  const log: SfxId[] = [];

  const apply = () => {
    const s = settings.get();
    if (!sfx) return;
    Howler.volume(s.volume.master);
    Howler.mute(s.muted);
    sfx.volume(s.volume.sfx);
    if (musicGain) musicGain.gain.value = s.muted ? 0 : s.volume.music;
  };

  const syncMusic = () => {
    if (!synth) return;
    const want = music.at(-1);
    if (!want) {
      synth.stop();
      return;
    }
    if (synth.playing !== want.track) synth.play(TRACKS[want.track], want.layers);
    else for (const l of want.layers) synth.setLayer(l, true);
  };

  const unlock = () => {
    if (sfx) return;
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    sfx = new Howl({
      src: [`${base}sfx.webm`, `${base}sfx.mp3`],
      sprite: Object.fromEntries(Object.entries(SFX_SPRITE).map(([k, v]) => [k, [...v]])),
      preload: true,
    });
    const ctx = Howler.ctx as AudioContext | null;
    if (ctx && Howler.usingWebAudio) {
      musicGain = ctx.createGain();
      musicGain.connect(Howler.masterGain);
      synth = new ChipSynth(ctx, musicGain);
    }
    apply();
    syncMusic();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }
  settings.subscribe(apply);

  const play = (id: SfxId, delayMs = 0): void => {
    log.push(id);
    if (log.length > LOG_SIZE) log.shift();
    const now = performance.now();
    const gap = MIN_GAP_MS[id];
    if (gap !== undefined && now - (lastPlayed.get(id) ?? -Infinity) < gap) return;
    lastPlayed.set(id, now);
    if (!sfx || channelGain(settings.get(), 'sfx') === 0) return;
    const howl = sfx;
    if (delayMs > 0) setTimeout(() => howl.play(id), delayMs);
    else howl.play(id);
  };

  return {
    play,
    /** Plays a track above the current one until the returned function is called. */
    pushMusic(track: TrackId, layers: string[] = []): () => void {
      const req = { track, layers };
      music.push(req);
      syncMusic();
      return () => {
        const i = music.indexOf(req);
        if (i >= 0) music.splice(i, 1);
        syncMusic();
      };
    },
    /** Plays the gain sounds for currencies that went up. */
    walletChanged(prev: Wallet | null, next: Wallet | null): void {
      walletGainSounds(prev, next).forEach((id, i) => {
        play(id, i * 120);
      });
    },
    log: (): readonly SfxId[] => log,
    get unlocked(): boolean {
      return sfx !== null;
    },
  };
}
export type AudioManager = ReturnType<typeof createAudioManager>;
