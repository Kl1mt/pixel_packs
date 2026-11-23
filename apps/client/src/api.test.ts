import { describe, expect, it } from 'vitest';
import { fetchHealth } from './api.js';

const okBody = {
  status: 'ok',
  service: 'pixel-packs-server',
  db: 'pglite',
  time: '2026-11-23T00:00:00.000Z',
};

function fakeFetch(status: number, body: unknown): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchHealth', () => {
  it('returns the parsed payload', async () => {
    await expect(fetchHealth(fakeFetch(200, okBody))).resolves.toEqual(okBody);
  });

  it('rejects on HTTP errors', async () => {
    await expect(fetchHealth(fakeFetch(502, {}))).rejects.toThrow('HTTP 502');
  });

  it('rejects malformed payloads', async () => {
    await expect(fetchHealth(fakeFetch(200, { status: 'nope' }))).rejects.toThrow();
  });
});
