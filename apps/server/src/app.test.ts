import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@pixel-packs/shared';
import { createTestApp, type TestApp } from './testing/harness.js';

describe('GET /api/health', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('answers with a valid health payload', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = HealthResponseSchema.parse(res.json());
    expect(body.db).toBe('pglite');
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'notFound', message: 'Not found.' } });
  });
});
