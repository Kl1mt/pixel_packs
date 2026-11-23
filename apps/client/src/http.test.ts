import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, createHttp } from './http.js';

type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown };

function fakeFetch(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: typeof fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    const { status, body } = handler(url, init);
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
    );
  };
  return { fn, calls };
}

const csrfHeader = (init: RequestInit) => new Headers(init.headers).get('x-csrf-token');

describe('createHttp', () => {
  it('fetches the CSRF token once and sends it on every mutation', async () => {
    const { fn, calls } = fakeFetch((url) =>
      url === '/api/auth/csrf' ? { status: 200, body: { csrfToken: 'tok' } } : { status: 204 },
    );
    const http = createHttp(fn);
    await http.post('/api/a', { x: 1 });
    await http.post('/api/b');
    expect(calls.map((c) => c.url)).toEqual(['/api/auth/csrf', '/api/a', '/api/b']);
    expect(csrfHeader(calls[1]?.init ?? {})).toBe('tok');
    expect((calls[1]?.init ?? {}).body).toBe('{"x":1}');
  });

  it('refreshes a stale CSRF token and retries once', async () => {
    let n = 0;
    const { fn, calls } = fakeFetch((url, init) => {
      if (url === '/api/auth/csrf') return { status: 200, body: { csrfToken: `t${String(++n)}` } };
      return csrfHeader(init) === 't2'
        ? { status: 200, body: { ok: true } }
        : { status: 403, body: { error: { code: 'csrf', message: 'bad' } } };
    });
    const res = await createHttp(fn).post('/api/x', {}, z.object({ ok: z.boolean() }));
    expect(res).toEqual({ ok: true });
    expect(calls).toHaveLength(4);
  });

  it('turns error bodies into ApiErrors', async () => {
    const { fn } = fakeFetch(() => ({
      status: 409,
      body: { error: { code: 'emailTaken', message: 'Taken.' } },
    }));
    const err = await createHttp(fn)
      .get('/api/x', z.unknown())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'emailTaken', message: 'Taken.' });
  });

  it('maps a bare 429 to rateLimited', async () => {
    const { fn } = fakeFetch(() => ({ status: 429 }));
    await expect(createHttp(fn).get('/api/x', z.unknown())).rejects.toMatchObject({
      code: 'rateLimited',
    });
  });
});
