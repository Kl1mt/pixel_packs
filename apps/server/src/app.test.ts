import { afterEach, describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@pixel-packs/shared';
import { buildApp } from './app.js';

describe('GET /api/health', () => {
  const app = buildApp({ dbKind: 'pglite' });
  afterEach(async () => {
    await app.close();
  });

  it('answers with a valid health payload', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = HealthResponseSchema.parse(res.json());
    expect(body.db).toBe('pglite');
  });
});
