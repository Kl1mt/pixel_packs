import type { LoginRequest, PublicUser, RegisterRequest } from '@pixel-packs/shared';
import type { AuthApi } from './api.js';

export type SessionState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'user'; user: PublicUser }
  /** The server could not be reached; the shell shows a retry. */
  | { status: 'offline' };

/** Who is logged in, as an external store for `useSyncExternalStore`. */
export function createSessionStore(api: AuthApi) {
  let state: SessionState = { status: 'loading' };
  const listeners = new Set<() => void>();
  const set = (next: SessionState) => {
    state = next;
    for (const l of listeners) l();
  };
  const setUser = (user: PublicUser) => {
    set({ status: 'user', user });
    return user;
  };

  return {
    get: () => state,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    /** Asks the server who we are (on startup and after OAuth redirects). */
    async refresh(): Promise<void> {
      try {
        const user = await api.me();
        set(user ? { status: 'user', user } : { status: 'guest' });
      } catch {
        set({ status: 'offline' });
      }
    },
    login: async (input: LoginRequest) => setUser(await api.login(input)),
    register: async (input: RegisterRequest) => setUser(await api.register(input)),
    async logout(): Promise<void> {
      await api.logout();
      set({ status: 'guest' });
    },
    /** After a password reset the server ends every session. */
    loggedOut: () => {
      set({ status: 'guest' });
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
