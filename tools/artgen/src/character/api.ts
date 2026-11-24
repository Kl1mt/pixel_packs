import { z } from 'zod';
import { UsageSchema } from '../api/schemas.js';
import type { PixelLabClient } from '../api/client.js';

/** Condensed schemas for the v3 character endpoints (docs/pixellab-api-notes.md). */

export const CharacterCreatedSchema = z.looseObject({
  background_job_id: z.string(),
  character_id: z.string(),
  status: z.string().optional(),
  usage: UsageSchema,
});

export const AnimationCreatedSchema = z.looseObject({
  background_job_ids: z.array(z.string()).min(1),
  directions: z.array(z.string()),
  animation_group_id: z.string().nullish(),
  status: z.string().optional(),
});

/** A frame is a CDN URL or an inline image, depending on the API version. */
const FrameSchema = z.union([
  z.string(),
  z.looseObject({ url: z.string() }),
  z.looseObject({ base64: z.string() }),
]);
export type Frame = z.infer<typeof FrameSchema>;

export const CharacterDetailSchema = z.looseObject({
  id: z.string(),
  status: z.string().default('completed'),
  view: z.string().nullish(),
  size: z.object({ width: z.number(), height: z.number() }).nullish(),
  rotation_urls: z.record(z.string(), z.string().nullish()).nullish(),
  animations: z
    .array(
      z.looseObject({
        animation_type: z.string().nullish(),
        display_name: z.string().nullish(),
        animation_group_id: z.string().nullish(),
        directions: z.array(
          z.looseObject({
            direction: z.string(),
            frame_count: z.number().nullish(),
            frames: z.array(FrameSchema),
          }),
        ),
      }),
    )
    .default([]),
});
export type CharacterDetail = z.infer<typeof CharacterDetailSchema>;

export async function frameBuffer(client: PixelLabClient, frame: Frame): Promise<Buffer> {
  if (typeof frame === 'string') return client.download(frame);
  if ('url' in frame && typeof frame.url === 'string') return client.download(frame.url);
  if (!('base64' in frame) || typeof frame.base64 !== 'string') throw new Error('bad frame');
  return Buffer.from(frame.base64.replace(/^data:image\/png;base64,/, ''), 'base64');
}

/** Polls the character until its rotations (or a new animation) have landed. */
export async function waitForCharacter(
  client: PixelLabClient,
  id: string,
  ready: (c: CharacterDetail) => boolean,
  tries = 30,
  sleepMs = 8000,
): Promise<CharacterDetail> {
  for (let i = 0; ; i++) {
    const c = await client.get(`/characters/${id}`, CharacterDetailSchema);
    if (c.status === 'failed') throw new Error(`character ${id} failed`);
    if (ready(c)) return c;
    if (i >= tries) throw new Error(`character ${id} not ready after ${String(tries)} polls`);
    await new Promise((r) => setTimeout(r, sleepMs));
  }
}
