import type { Wallet as ApiWallet } from '@pixel-packs/shared';
import { economyStore, useEconomy } from '../economy/useEconomy.js';
import type { Wallet } from './AppShell.js';

/** Tells the top bar (and the shop) about a new balance (e.g. after dusting), without refetching. */
export function publishWallet(wallet: ApiWallet): void {
  economyStore.setWallet(wallet);
}

/** Balances for the top bar; unknown ("–") while loading or when logged out. */
export function useWallet(enabled: boolean): Wallet | null {
  const snap = useEconomy(enabled);
  return enabled && snap.status === 'ready' ? snap.state.wallet : null;
}
