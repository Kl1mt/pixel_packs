import { z } from 'zod';

/** Condensed Zod schemas for the PixelLab v2 endpoints we use (see docs/pixellab-api-notes.md). */

export const UsageSchema = z
  .object({
    type: z.string(),
    usd: z.number().nullish(),
    generations: z.number().nullish(),
  })
  .nullish();

export const BalanceSchema = z.object({
  credits: z.object({ type: z.string(), usd: z.number() }),
  subscription: z.object({
    type: z.string(),
    status: z.string(),
    plan: z.string(),
    generations: z.number(),
    total: z.number(),
  }),
});
export type Balance = z.infer<typeof BalanceSchema>;

export const JobCreatedSchema = z.object({
  background_job_id: z.string(),
  status: z.string(),
  usage: UsageSchema,
});

export const Base64ImageSchema = z.object({
  type: z.literal('base64').optional(),
  base64: z.string(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
});

export const JobStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['processing', 'completed', 'failed']),
  created_at: z.string(),
  usage: UsageSchema,
  last_response: z
    .looseObject({
      images: z.array(Base64ImageSchema).optional(),
      seed: z.coerce.number().optional(),
      error: z.unknown().optional(),
      usage_cost_usd: z.coerce.number().optional(),
    })
    .nullish(),
});
export type JobStatus = z.infer<typeof JobStatusSchema>;

export interface TargetPalette {
  colors: string[];
  name?: string | undefined;
  max_colors?: number | undefined;
}

export interface ApiImage {
  type: 'base64';
  base64: string;
  format: 'png';
}

/** POST /generate-image-v2 (Pro text-to-image; 64×64 → 16 candidates for 10 generations). */
export interface GenerateImageV2Body {
  description: string;
  image_size: { width: number; height: number };
  seed?: number | undefined;
  no_background?: boolean | undefined;
  target_palette?: TargetPalette | undefined;
}

/** POST /generate-with-style-v2 (output size = largest style image; 64×64 → 16 candidates). */
export interface GenerateWithStyleV2Body {
  description: string;
  style_images: { image: ApiImage; width: number; height: number }[];
  style_description?: string | undefined;
  seed?: number | undefined;
  no_background?: boolean | undefined;
  target_palette?: TargetPalette | undefined;
}

export type Endpoint = 'generate-image-v2' | 'generate-with-style-v2';

export type EndpointBody = {
  'generate-image-v2': GenerateImageV2Body;
  'generate-with-style-v2': GenerateWithStyleV2Body;
};

/**
 * Generations charged per call, measured in T04 (2026-11-23). Both Pro endpoints
 * charge per call, not per candidate: 10 for a 64×64 canvas.
 */
export const ENDPOINT_COST: Record<Endpoint, number> = {
  'generate-image-v2': 10,
  'generate-with-style-v2': 10,
};
