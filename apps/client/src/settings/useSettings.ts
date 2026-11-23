import { useEffect, useSyncExternalStore } from 'react';
import { createSettingsStore, resolveReducedMotion, type Settings } from './settings.js';

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The app-wide settings store. */
export const settingsStore = createSettingsStore(browserStorage());

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeSystemMotion(cb: () => void): () => void {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', cb);
  return () => {
    mq.removeEventListener('change', cb);
  };
}
const systemPrefersReduced = () => window.matchMedia(REDUCED_QUERY).matches;

/** True when UI motion should be reduced (in-game choice or OS setting). */
export function useReducedMotion(): boolean {
  const { motion } = useSettings();
  const system = useSyncExternalStore(subscribeSystemMotion, systemPrefersReduced, () => false);
  return resolveReducedMotion(motion, system);
}

/** Mirrors motion and effects settings onto `<html data-motion data-effects>` for CSS. */
export function useApplySettingsToDocument(): void {
  const reduced = useReducedMotion();
  const { reduceEffects } = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.motion = reduced ? 'reduced' : 'full';
    el.dataset.effects = reduceEffects ? 'reduced' : 'full';
  }, [reduced, reduceEffects]);
}
