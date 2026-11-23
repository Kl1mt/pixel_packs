import { useEffect, useState } from 'react';
import { EconomyStateSchema, type Wallet as ApiWallet } from '@pixel-packs/shared';
import { http } from '../http.js';
import type { Wallet } from './AppShell.js';

type Listener = (w: ApiWallet) => void;
const listeners = new Set<Listener>();

/** Tells the top bar about a new balance (e.g. after dusting), without refetching. */
export function publishWallet(wallet: ApiWallet): void {
  for (const l of listeners) l(wallet);
}

/** Balances for the top bar; unknown ("–") while loading or when logged out. */
export function useWallet(enabled: boolean): Wallet | null {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    http.get('/api/economy', EconomyStateSchema).then(
      (s) => {
        if (live) setWallet(s.wallet);
      },
      () => undefined,
    );
    const listener: Listener = (w) => {
      if (live) setWallet(w);
    };
    listeners.add(listener);
    return () => {
      live = false;
      listeners.delete(listener);
    };
  }, [enabled]);
  return enabled ? wallet : null;
}
