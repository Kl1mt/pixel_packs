import { useEffect, useSyncExternalStore } from 'react';
import { economyApi } from './api.js';
import { createEconomyStore, type EconomySnapshot } from './store.js';

/** The app-wide economy store, loaded by the first screen that needs it. */
export const economyStore = createEconomyStore(() => economyApi.state());

/** The economy snapshot; fetches it once when `enabled` and nothing is loaded yet. */
export function useEconomy(enabled = true): EconomySnapshot {
  const snap = useSyncExternalStore(economyStore.subscribe, economyStore.get, economyStore.get);
  useEffect(() => {
    if (enabled && economyStore.get().status === 'idle') void economyStore.refresh();
  }, [enabled]);
  return snap;
}
