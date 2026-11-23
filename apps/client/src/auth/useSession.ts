import { useSyncExternalStore } from 'react';
import { authApi } from './api.js';
import { createSessionStore, type SessionState } from './session.js';

/** The app-wide session store; `main.tsx` calls `refresh()` once at startup. */
export const sessionStore = createSessionStore(authApi);

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}
