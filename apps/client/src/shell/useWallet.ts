import { useEffect, useState } from 'react';
import { EconomyStateSchema } from '@pixel-packs/shared';
import { http } from '../http.js';
import type { Wallet } from './AppShell.js';

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
    return () => {
      live = false;
    };
  }, [enabled]);
  return enabled ? wallet : null;
}
