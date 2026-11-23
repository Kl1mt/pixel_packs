import { describe, expect, it } from 'vitest';
import type { PublicUser } from '@pixel-packs/shared';
import { ApiError } from '../http.js';
import type { AuthApi } from './api.js';
import { createSessionStore } from './session.js';
import { validateRegister } from './RegisterPage.js';

const pip: PublicUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'pip@example.com',
  username: 'pip',
  emailVerified: false,
  onboardingStep: 0,
  createdAt: '2026-11-23T00:00:00.000Z',
};

function fakeApi(me: () => Promise<PublicUser | null>): AuthApi {
  return {
    me,
    login: () => Promise.resolve(pip),
    register: () => Promise.resolve(pip),
    logout: () => Promise.resolve(undefined),
  } as Partial<AuthApi> as AuthApi;
}

describe('session store', () => {
  it('starts loading, then knows guest or user', async () => {
    const store = createSessionStore(fakeApi(() => Promise.resolve(null)));
    expect(store.get().status).toBe('loading');
    await store.refresh();
    expect(store.get().status).toBe('guest');
    await store.login({ email: pip.email, password: 'x' });
    expect(store.get()).toEqual({ status: 'user', user: pip });
    await store.logout();
    expect(store.get().status).toBe('guest');
  });

  it('is offline when the server cannot be reached, and notifies listeners', async () => {
    const store = createSessionStore(
      fakeApi(() => Promise.reject(new ApiError(0, 'internal', 'offline'))),
    );
    let calls = 0;
    const off = store.subscribe(() => (calls += 1));
    await store.refresh();
    off();
    expect(store.get().status).toBe('offline');
    expect(calls).toBe(1);
  });
});

describe('validateRegister', () => {
  it('uses the shared rules', () => {
    expect(
      validateRegister({ email: 'a@b.co', username: 'pip_1', password: 'x'.repeat(10) }),
    ).toEqual({});
    const e = validateRegister({ email: 'nope', username: 'a!', password: 'short' });
    expect(Object.keys(e).sort()).toEqual(['email', 'password', 'username']);
  });
});
