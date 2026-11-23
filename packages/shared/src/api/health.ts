import { z } from 'zod';

/** Response of `GET /api/health`, shared by server and client. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('pixel-packs-server'),
  db: z.enum(['pglite', 'postgres']),
  time: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
