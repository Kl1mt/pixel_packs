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
      image_url: z.string().optional(),
      /** generate-font-pro: the TrueType file. */
      ttf_base64: z.string().optional(),
      /** ui-assets/states: the saved state assets. */
      created_state_ids: z.array(z.string()).optional(),
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

/** POST /create-image-pro-flash (one image; 5 generations up to 96 px, 6 at 96×128). */
export interface ProFlashBody {
  description: string;
  image_size: { width: number; height: number };
  seed?: number | undefined;
  no_background?: boolean | undefined;
  target_palette?: TargetPalette | undefined;
  style_image?:
    | {
        image: ApiImage;
        size: { width: number; height: number };
        usage_description?: string | undefined;
      }
    | undefined;
  style_options?:
    { color_palette: boolean; outline: boolean; detail: boolean; shading: boolean } | undefined;
}

/** POST /create-image-pixflux (synchronous, one image, 1 generation). */
export interface PixfluxBody {
  description: string;
  image_size: { width: number; height: number };
  seed?: number | undefined;
  no_background?: boolean | undefined;
  /** Forced palette: an image containing the allowed colours. */
  color_image?: ApiImage | undefined;
  outline?: string | undefined;
  shading?: string | undefined;
  detail?: string | undefined;
  view?: string | undefined;
}

/** POST /generate-font-pro (80-glyph atlas + TTF; 15 generations). */
export interface FontProBody {
  description: string;
  weight: 'Bold' | 'Regular';
  glyph_px: 8 | 12 | 16 | 24 | 32 | 64;
  seed?: number | undefined;
  font_name?: string | undefined;
}

/** POST /create-ui-asset (a UI template; 10 generations up to 256×256). */
export interface UiAssetBody {
  description: string;
  image_size: { width: number; height: number };
  elements?: string[] | undefined;
  color_palette?: string | undefined;
  target_palette?: TargetPalette | undefined;
  style_image?: ApiImage | undefined;
  no_background?: boolean | undefined;
  seed?: number | undefined;
  name?: string | undefined;
}

/** POST /ui-assets/states (every element in every state on one grid; 10 up to a 256 px grid). */
export interface UiStatesBody {
  element_ids: string[];
  states: { name: string; description: string }[];
  target_palette?: TargetPalette | undefined;
}

export type Endpoint =
  | 'generate-image-v2'
  | 'generate-with-style-v2'
  | 'create-image-pro-flash'
  | 'create-image-pixflux'
  | 'generate-font-pro'
  | 'create-ui-asset'
  | 'ui-assets/states';

export type EndpointBody = {
  'generate-image-v2': GenerateImageV2Body;
  'generate-with-style-v2': GenerateWithStyleV2Body;
  'create-image-pro-flash': ProFlashBody;
  'create-image-pixflux': PixfluxBody;
  'generate-font-pro': FontProBody;
  'create-ui-asset': UiAssetBody;
  'ui-assets/states': UiStatesBody;
};

export const PixfluxResponseSchema = z.object({
  usage: UsageSchema,
  image: Base64ImageSchema,
});

export const UiAssetCreatedSchema = JobCreatedSchema.extend({ ui_asset_id: z.string() });

const NineSliceSchema = z.object({
  left: z.number(),
  right: z.number(),
  top: z.number(),
  bottom: z.number(),
});

export interface UiAssetPart {
  id: string;
  name?: string | null | undefined;
  kind?: string | null | undefined;
  image_url?: string | null | undefined;
  nine_slice?: z.infer<typeof NineSliceSchema> | null | undefined;
  states?: UiAssetPart[] | undefined;
}

export const UiAssetPartSchema: z.ZodType<UiAssetPart> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string().nullish(),
    kind: z.string().nullish(),
    image_url: z.string().nullish(),
    nine_slice: NineSliceSchema.nullish(),
    states: z.array(UiAssetPartSchema).optional(),
  }),
);

export const UiAssetDetailSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  status: z.string().nullish(),
  image_url: z.string().nullish(),
  nine_slice: NineSliceSchema.nullish(),
  elements: z.array(UiAssetPartSchema).default([]),
  states: z.array(UiAssetPartSchema).default([]),
  split_preview: z.array(z.unknown()).default([]),
});
export type UiAssetDetail = z.infer<typeof UiAssetDetailSchema>;

export const SplitResponseSchema = z.object({
  usage: UsageSchema,
  elements: z.array(UiAssetPartSchema),
});

/** Documented UI price ladder by the longest side of the generated canvas/grid. */
export function uiCost(side: number): number {
  return side <= 256 ? 10 : side <= 341 ? 15 : 25;
}

/**
 * Generations charged per call. The two Pro image endpoints were measured in T04
 * (10 per call at 64×64, not per candidate); the rest are documented prices
 * (T06 confirms them from receipts, see docs/pixellab-api-notes.md).
 */
export const ENDPOINT_COST: Record<Endpoint, number> = {
  'generate-image-v2': 10,
  'generate-with-style-v2': 10,
  'create-image-pro-flash': 5,
  'create-image-pixflux': 1,
  'generate-font-pro': 15,
  'create-ui-asset': 10,
  'ui-assets/states': 10,
};
