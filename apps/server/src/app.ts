import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { HealthResponseSchema, type HealthResponse } from '@pixel-packs/shared';
import type { DbKind } from './db/client.js';

export interface AppDeps {
  dbKind: DbKind;
}

/** Builds the Fastify app without listening, so tests can use `app.inject`. */
export function buildApp(deps: AppDeps, options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);

  app.get('/api/health', (): HealthResponse => {
    return HealthResponseSchema.parse({
      status: 'ok',
      service: 'pixel-packs-server',
      db: deps.dbKind,
      time: new Date().toISOString(),
    });
  });

  return app;
}
