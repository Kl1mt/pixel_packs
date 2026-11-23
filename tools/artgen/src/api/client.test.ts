import { describe, expect, it, vi } from 'vitest';
import { createPixelLabClient, isRetryableStatus, PixelLabError } from './client.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const balance = {
  credits: { type: 'usd', usd: 0 },
  subscription: { type: 'generations', status: 'active', plan: 'T1', generations: 5, total: 9 },
};

function client(responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of responses) fetch.mockResolvedValueOnce(r);
  const sleep = vi.fn(() => Promise.resolve());
  return {
    fetch,
    sleep,
    api: createPixelLabClient({ fetch, sleep, backoffMs: 10, maxRetries: 2 }),
  };
}

describe('PixelLab client', () => {
  it('classifies retryable statuses', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(402)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
  });

  it('retries 429/5xx with exponential backoff', async () => {
    const { api, fetch, sleep } = client([json(429, {}), json(502, {}), json(200, balance)]);
    await expect(api.balance()).resolves.toMatchObject({ subscription: { generations: 5 } });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it('gives up after maxRetries', async () => {
    const { api, fetch } = client([json(500, {}), json(500, {}), json(500, {})]);
    await expect(api.balance()).rejects.toBeInstanceOf(PixelLabError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry 402 (out of generations)', async () => {
    const { api, fetch } = client([json(402, { detail: 'no generations' })]);
    await expect(
      api.submit('generate-image-v2', { description: 'x', image_size: { width: 64, height: 64 } }),
    ).rejects.toMatchObject({ status: 402, retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('submits a job and polls until it completes', async () => {
    const job = (status: string) => ({ id: 'j1', status, created_at: '2026-11-23T00:00:00Z' });
    const { api, fetch, sleep } = client([
      json(202, { background_job_id: 'j1', status: 'processing', usage: null }),
      json(200, job('processing')),
      json(200, {
        ...job('completed'),
        usage: { type: 'generations', generations: 10 },
        last_response: { images: [{ type: 'base64', base64: 'AA==', width: '64', height: '64' }] },
      }),
    ]);
    const id = await api.submit('generate-image-v2', {
      description: 'x',
      image_size: { width: 64, height: 64 },
    });
    expect(id).toBe('j1');
    const done = await api.waitForJob(id);
    expect(done.status).toBe('completed');
    expect(done.usage?.generations).toBe(10);
    expect(done.last_response?.images?.[0]?.width).toBe(64);
    expect(fetch.mock.calls[1]?.[0]).toBe('https://api.pixellab.ai/v2/background-jobs/j1');
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('sends a bearer token only when one is given', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() => Promise.resolve(json(200, balance)));
    await createPixelLabClient({ fetch }).balance();
    await createPixelLabClient({ fetch, apiKey: 'k' }).balance();
    const headers = fetch.mock.calls.map((c) => (c[1]?.headers ?? {}) as Record<string, string>);
    expect(headers[0]?.Authorization).toBeUndefined();
    expect(headers[1]?.Authorization).toBe('Bearer k');
  });
});
