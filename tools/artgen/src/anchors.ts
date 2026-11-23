import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { RealmSchema } from '@pixel-packs/shared';
import { ARTGEN_DIR } from './paths.js';

/** The approved style anchors (T04) that every card-art job uses (GDD §19). */
export const AnchorsSchema = z.object({
  approvedOn: z.string(),
  endpoint: z.literal('generate-with-style-v2'),
  styleDescription: z.string().min(1).max(500),
  noBackground: z.boolean(),
  realms: z.partialRecord(
    RealmSchema,
    z.object({ palette: RealmSchema, styleImages: z.array(z.string()).min(1).max(4) }),
  ),
});
export type Anchors = z.infer<typeof AnchorsSchema>;

export async function loadAnchors(path = `${ARTGEN_DIR}/anchors.json`): Promise<Anchors> {
  return AnchorsSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
