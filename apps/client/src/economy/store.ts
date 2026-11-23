import type { EconomyState, Wallet } from '@pixel-packs/shared';

export type EconomySnapshot =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; state: EconomyState }
  | { status: 'error' };

/**
 * The player's economy state (wallet, packs, pity, pending opening) as an external
 * store, so the top bar and the pack shelf show the same numbers after every change.
 */
export function createEconomyStore(load: () => Promise<EconomyState>) {
  let snap: EconomySnapshot = { status: 'idle' };
  const listeners = new Set<() => void>();
  const set = (next: EconomySnapshot) => {
    snap = next;
    for (const l of listeners) l();
  };
  let inflight: Promise<void> | null = null;

  return {
    get: () => snap,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    /** Fetches the state; concurrent calls share one request. Keeps old data while loading. */
    refresh(): Promise<void> {
      if (snap.status !== 'ready') set({ status: 'loading' });
      inflight ??= load()
        .then(
          (state) => {
            set({ status: 'ready', state });
          },
          () => {
            if (snap.status !== 'ready') set({ status: 'error' });
          },
        )
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    /** A mutation answered with the new state (buy, claim, dev grant). */
    set: (state: EconomyState) => {
      set({ status: 'ready', state });
    },
    /** A mutation answered with a new wallet only (dusting). */
    setWallet: (wallet: Wallet) => {
      if (snap.status === 'ready') set({ status: 'ready', state: { ...snap.state, wallet } });
    },
    /** Logged out: forget everything. */
    clear: () => {
      set({ status: 'idle' });
    },
  };
}

export type EconomyStore = ReturnType<typeof createEconomyStore>;
