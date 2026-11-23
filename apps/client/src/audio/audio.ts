import { useEffect } from 'react';
import { economyStore } from '../economy/useEconomy.js';
import { settingsStore } from '../settings/useSettings.js';
import { createAudioManager } from './manager.js';
import { installUiSounds } from './uiSounds.js';
import type { TrackId } from './music/tracks.js';

/** The app-wide audio manager (GDD §20). */
export const audio = createAudioManager(settingsStore);

if (typeof document !== 'undefined') installUiSounds(document, audio.play);

// Currency gains anywhere (claims, dusting, grants) play their sound.
let lastWallet = walletOf();
economyStore.subscribe(() => {
  const next = walletOf();
  audio.walletChanged(lastWallet, next);
  lastWallet = next;
});
function walletOf() {
  const s = economyStore.get();
  return s.status === 'ready' ? s.state.wallet : null;
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __pixelPacksAudio: typeof audio }).__pixelPacksAudio = audio;
}

/** Plays a music track while the calling component is mounted. */
export function useMusic(track: TrackId, layers: readonly string[] = []): void {
  const key = layers.join(',');
  useEffect(() => audio.pushMusic(track, key ? key.split(',') : []), [track, key]);
}
