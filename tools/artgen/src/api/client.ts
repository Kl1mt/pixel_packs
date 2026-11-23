import type { z } from 'zod';
import {
  BalanceSchema,
  JobCreatedSchema,
  JobStatusSchema,
  type Balance,
  type Endpoint,
  type EndpointBody,
  type JobStatus,
} from './schemas.js';

export const PIXELLAB_BASE_URL = 'https://api.pixellab.ai/v2';

export class PixelLabError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'PixelLabError';
  }
}

export interface ClientOptions {
  baseUrl?: string;
  /** Sent as a Bearer token. In cloud sessions the proxy injects the key, so leave it unset. */
  apiKey?: string | undefined;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** First backoff delay; doubles each retry. */
  backoffMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  log?: (msg: string) => void;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 429 (concurrency/rate) and 5xx are retried; 4xx (402 = out of generations, 422 = bad body) are not. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function createPixelLabClient(opts: ClientOptions = {}) {
  const baseUrl = opts.baseUrl ?? PIXELLAB_BASE_URL;
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? realSleep;
  const maxRetries = opts.maxRetries ?? 4;
  const backoffMs = opts.backoffMs ?? 2000;
  const pollIntervalMs = opts.pollIntervalMs ?? 8000;
  const pollTimeoutMs = opts.pollTimeoutMs ?? 15 * 60_000;
  const log = opts.log ?? (() => undefined);

  async function request<S extends z.ZodType>(
    method: 'GET' | 'POST',
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<z.infer<S>> {
    for (let attempt = 0; ; attempt++) {
      let error: PixelLabError;
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
        const res = await doFetch(`${baseUrl}${path}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (res.ok) return schema.parse(await res.json());
        const text = (await res.text()).slice(0, 500);
        error = new PixelLabError(
          `${method} ${path} → ${res.status}: ${text}`,
          res.status,
          isRetryableStatus(res.status),
        );
      } catch (e) {
        if (e instanceof Error && e.name === 'ZodError') throw e;
        error = new PixelLabError(`${method} ${path} failed: ${String(e)}`, null, true);
      }
      if (!error.retryable || attempt >= maxRetries) throw error;
      const delay = backoffMs * 2 ** attempt;
      log(`  retry ${attempt + 1}/${maxRetries} in ${delay} ms (${error.message.slice(0, 120)})`);
      await sleep(delay);
    }
  }

  async function waitForJob(jobId: string): Promise<JobStatus> {
    const started = Date.now();
    for (;;) {
      const job = await request('GET', `/background-jobs/${jobId}`, JobStatusSchema);
      if (job.status !== 'processing') return job;
      if (Date.now() - started > pollTimeoutMs) {
        throw new PixelLabError(`job ${jobId} still processing after timeout`, null, false);
      }
      await sleep(pollIntervalMs);
    }
  }

  return {
    balance: (): Promise<Balance> => request('GET', '/balance', BalanceSchema),

    /** Submits a background job and returns its id. Never retried after a 2xx, so no double charge. */
    async submit<E extends Endpoint>(endpoint: E, body: EndpointBody[E]): Promise<string> {
      const created = await request('POST', `/${endpoint}`, JobCreatedSchema, body);
      return created.background_job_id;
    },

    waitForJob,
  };
}

export type PixelLabClient = ReturnType<typeof createPixelLabClient>;
