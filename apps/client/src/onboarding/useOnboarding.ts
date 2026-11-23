import { useEffect, useSyncExternalStore } from 'react';
import type { OnboardingStage, OnboardingState } from '@pixel-packs/shared';
import { onboardingApi } from './api.js';

export type OnboardingSnapshot =
  { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; state: OnboardingState };

let snap: OnboardingSnapshot = { status: 'idle' };
const listeners = new Set<() => void>();
const publish = (next: OnboardingSnapshot) => {
  snap = next;
  for (const l of listeners) l();
};

/**
 * Where the player is in onboarding (GDD §17), shared by Home (which sends unfinished
 * players to `/welcome`), the welcome flow and the binder tour.
 */
export const onboardingStore = {
  get: () => snap,
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  async refresh(): Promise<void> {
    if (snap.status !== 'ready') publish({ status: 'loading' });
    try {
      publish({ status: 'ready', state: await onboardingApi.state() });
    } catch {
      if (snap.status !== 'ready') publish({ status: 'error' });
    }
  },
  /** Moves forward (the server ignores moves backwards) and keeps the answer. */
  async advance(stage: OnboardingStage): Promise<OnboardingState> {
    const state = await onboardingApi.advance(stage);
    publish({ status: 'ready', state });
    return state;
  },
  clear: () => {
    publish({ status: 'idle' });
  },
};

/** The onboarding snapshot; fetches it when nothing is loaded yet. */
export function useOnboarding(): OnboardingSnapshot {
  const s = useSyncExternalStore(onboardingStore.subscribe, onboardingStore.get);
  useEffect(() => {
    if (onboardingStore.get().status === 'idle') void onboardingStore.refresh();
  }, []);
  return s;
}
