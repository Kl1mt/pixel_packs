import { z } from 'zod';
import { CARD_CATALOG, StarsSchema, VariantSchema, needsMintNumber } from '@pixel-packs/shared';
import type { CardSpec } from '../render/cardView.js';

const ids = CARD_CATALOG.map((c) => c.id);
const DEFAULT_CARD = 'MOS-012';

/** `/debug` state lives in the URL so any combination can be linked and screenshotted. */
const DebugParamsSchema = z.object({
  card: z
    .string()
    .refine((id) => ids.includes(id))
    .catch(DEFAULT_CARD),
  variant: VariantSchema.catch('foil'),
  stars: z.coerce.number().pipe(StarsSchema).catch(1),
  edition: z.coerce.number().int().min(0).max(99).catch(0),
  mint: z.coerce.number().int().min(1).max(99999).catch(12),
  fx: z.enum(['settings', 'full', 'reduced']).catch('settings'),
  stress: z.coerce.number().int().min(0).max(24).catch(0),
  /** Show the all-variants row (0 hides it, e.g. to time one card alone). */
  all: z.coerce.number().int().min(0).max(1).catch(1),
  /** Hold the shader clock at this many seconds; -1 runs live. */
  freeze: z.coerce.number().min(-1).max(3600).catch(-1),
});
export type DebugParams = z.infer<typeof DebugParamsSchema>;

export function parseDebugParams(q: URLSearchParams): DebugParams {
  return DebugParamsSchema.parse({
    card: q.get('card') ?? undefined,
    variant: q.get('variant') ?? undefined,
    stars: q.get('stars') ?? undefined,
    edition: q.get('edition') ?? undefined,
    mint: q.get('mint') ?? undefined,
    fx: q.get('fx') ?? undefined,
    stress: q.get('stress') ?? undefined,
    all: q.get('all') ?? undefined,
    freeze: q.get('freeze') ?? undefined,
  });
}

/** The copy the params describe. Mint numbers only exist on Void and Glitch copies. */
export function debugSpec(p: DebugParams, variant = p.variant): CardSpec {
  const card = CARD_CATALOG.find((c) => c.id === p.card) ?? CARD_CATALOG[0];
  if (!card) throw new Error('empty catalog');
  return {
    card,
    variant,
    stars: p.stars,
    edition: p.edition > 0 ? { season: p.edition } : null,
    mintNumber: needsMintNumber(variant) ? p.mint : null,
  };
}
