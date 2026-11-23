import { useEconomy } from '../economy/useEconomy.js';
import type { Wallet } from './AppShell.js';

/** Balances for the top bar; unknown ("–") while loading or when logged out. */
export function useWallet(enabled: boolean): Wallet | null {
  const snap = useEconomy(enabled);
  return enabled && snap.status === 'ready' ? snap.state.wallet : null;
}
