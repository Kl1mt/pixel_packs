import { z } from 'zod';
import {
  CARD_CATALOG,
  ENABLED_REALMS,
  RaritySchema,
  RealmSchema,
  VariantSchema,
  type OpenedCard,
  type Rarity,
  type Realm,
} from '@pixel-packs/shared';
import type { PackMood } from '../opening/reveal.js';

/** `/debug/moments` state lives in the URL, so every rarity × variant can be linked. */
const MomentLabSchema = z.object({
  /** `reveal` plays the featured card's moment; `tear` shows the realm's pack tear. */
  scene: z.enum(['reveal', 'tear']).catch('reveal'),
  rarity: RaritySchema.catch('legendary'),
  variant: VariantSchema.catch('normal'),
  realm: RealmSchema.refine((r) => ENABLED_REALMS.includes(r)).catch('starhollow'),
  fx: z.enum(['settings', 'full', 'reduced']).catch('settings'),
  /** Hold the moment at this many ms; -1 plays it live. */
  at: z.coerce.number().int().min(-1).max(20000).catch(-1),
});
export type MomentLabParams = z.infer<typeof MomentLabSchema>;

export function parseMomentLab(q: URLSearchParams): MomentLabParams {
  return MomentLabSchema.parse({
    scene: q.get('scene') ?? undefined,
    rarity: q.get('rarity') ?? undefined,
    variant: q.get('variant') ?? undefined,
    realm: q.get('realm') ?? undefined,
    fx: q.get('fx') ?? undefined,
    at: q.get('at') ?? undefined,
  });
}

const pick = (realm: Realm, rarity: Rarity) => {
  const card =
    CARD_CATALOG.find((c) => c.realm === realm && c.rarity === rarity) ??
    CARD_CATALOG.find((c) => c.rarity === rarity);
  if (!card) throw new Error(`No ${rarity} card`);
  return card;
};

/**
 * A pretend opening for the preview: four Commons already flipped and the chosen card
 * in the featured slot (nothing is sent to the server).
 */
const made = new Map<string, OpenedCard[]>();

/** The same objects for the same choice, so a re-render doesn't restart the moment. */
export function labSequence(
  p: Pick<MomentLabParams, 'realm' | 'rarity' | 'variant'>,
): OpenedCard[] {
  const key = `${p.realm}/${p.rarity}/${p.variant}`;
  const hit = made.get(key);
  if (hit) return hit;
  const seq = buildSequence(p);
  made.set(key, seq);
  return seq;
}

function buildSequence(p: Pick<MomentLabParams, 'realm' | 'rarity' | 'variant'>): OpenedCard[] {
  const filler = CARD_CATALOG.filter((c) => c.realm === p.realm && c.rarity === 'common');
  const mint = p.variant === 'void' || p.variant === 'glitch' ? 7 : null;
  const opened = (slot: number, id: string, rarity: Rarity, featured: boolean): OpenedCard => ({
    slot,
    featured,
    cardId: id,
    realm: p.realm,
    rarity,
    variant: featured ? p.variant : 'normal',
    userCardId: `00000000-0000-4000-8000-00000000000${String(slot)}`,
    mintNumber: featured ? mint : null,
    edition: null,
    isNew: featured,
  });
  const main = pick(p.realm, p.rarity);
  return [
    ...[1, 2, 3, 4].map((s) => opened(s, filler[s - 1]?.id ?? main.id, 'common', false)),
    opened(5, main.id, main.rarity, true),
  ];
}

/** The tear mood a pack with this featured rarity would have. */
export const labMood = (r: Rarity): PackMood =>
  r === 'mythic' ? 'mythic' : r === 'legendary' ? 'golden' : r === 'epic' ? 'epic' : 'calm';
