import {
  ApiErrorSchema,
  CSRF_HEADER,
  CsrfResponseSchema,
  type ApiErrorCode,
} from '@pixel-packs/shared';
import type { z } from 'zod';

/** An error answer from the API, with its code (shared `ApiErrorCode`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Http {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  /** A mutation: sends the CSRF token, which is fetched once and cached. */
  post<T>(path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T | undefined>;
  /** Drops the cached CSRF token (e.g. after a 403 `csrf`). */
  resetCsrf(): void;
}

async function toError(res: Response): Promise<ApiError> {
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
  if (parsed.success)
    return new ApiError(res.status, parsed.data.error.code, parsed.data.error.message);
  return new ApiError(
    res.status,
    res.status === 429 ? 'rateLimited' : 'internal',
    res.status === 429
      ? 'Too many tries. Please wait a few minutes.'
      : 'The post office is not answering. Please try again.',
  );
}

/** JSON client for `/api` (same origin; Vite proxies it in dev). */
export function createHttp(fetchFn: typeof fetch = (...a) => fetch(...a)): Http {
  let csrf: Promise<string> | null = null;
  const csrfToken = () =>
    (csrf ??= fetchFn('/api/auth/csrf', { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw await toError(r);
        return CsrfResponseSchema.parse(await r.json()).csrfToken;
      })
      .catch((err: unknown) => {
        csrf = null;
        throw err;
      }));

  async function send(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetchFn(path, { credentials: 'same-origin', ...init });
    } catch {
      throw new ApiError(0, 'internal', 'You seem to be offline. Please try again.');
    }
    if (!res.ok) throw await toError(res);
    return res;
  }

  return {
    async get(path, schema) {
      const res = await send(path, { method: 'GET' });
      return schema.parse(await res.json());
    },

    async post(path, body, schema) {
      const attempt = async () =>
        send(path, {
          method: 'POST',
          headers: {
            [CSRF_HEADER]: await csrfToken(),
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      let res: Response;
      try {
        res = await attempt();
      } catch (err) {
        // A stale token (cookie cleared): fetch a fresh one and retry once.
        if (!(err instanceof ApiError && err.code === 'csrf')) throw err;
        csrf = null;
        res = await attempt();
      }
      if (schema === undefined || res.status === 204 || res.status === 202) return undefined;
      return schema.parse(await res.json());
    },

    resetCsrf() {
      csrf = null;
    },
  };
}

export const http = createHttp();
