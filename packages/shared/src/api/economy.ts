import { z } from 'zod';
import { CardIdSchema, EditionStampSchema } from '../model/card.js';
import { RaritySchema, RealmSchema, VariantSchema } from '../model/enums.js';
import { PityTriggerSchema, PityGroupSchema, RolledCardSchema } from '../model/pack.js';
import { MAX_PACKS_PER_PURCHASE } from '../config/economy.js';

/** Pack type ids as stored on the server: `realm:<realm>` or `mythic`. */
export const PackTypeIdSchema = z.union([
  z.templateLiteral(['realm:', RealmSchema]),
  z.literal('mythic'),
]);
export type PackTypeId = z.infer<typeof PackTypeIdSchema>;

/** Client-made key (e.g. `crypto.randomUUID()`) that makes a retried mutation safe. */
export const IdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const CurrencySchema = z.enum(['gold', 'dust', 'gems']);
export type Currency = z.infer<typeof CurrencySchema>;

export const WalletSchema = z.object({
  gold: z.int().min(0),
  dust: z.int().min(0),
  gems: z.int().min(0),
});
export type Wallet = z.infer<typeof WalletSchema>;

export const PityMeterSchema = z.object({
  group: PityGroupSchema,
  packsSinceLegendaryPlus: z.int().min(0),
  packsSinceMythic: z.int().min(0),
  legendaryHardPity: z.int(),
  mythicSoftPityStart: z.int().nullable(),
  mythicHardPity: z.int(),
});
export type PityMeter = z.infer<typeof PityMeterSchema>;

export const FreePackStateSchema = z.object({
  stored: z.int().min(0),
  max: z.int(),
  nextAt: z.iso.datetime().nullable(),
});

export const CalendarStateSchema = z.object({
  /** Calendar day (1–7) that the next claim pays. */
  day: z.int().min(1).max(7),
  claimedToday: z.boolean(),
  nextResetAt: z.iso.datetime(),
  rewards: z.array(z.object({ gold: z.int(), dust: z.int() })).length(7),
});

export const EconomyStateSchema = z.object({
  wallet: WalletSchema,
  packs: z.array(z.object({ packTypeId: PackTypeIdSchema, count: z.int().min(1) })),
  freePack: FreePackStateSchema,
  calendar: CalendarStateSchema,
  pity: z.array(PityMeterSchema),
  /** An opening whose reveal was never finished: show "Resume reveal". */
  pendingOpeningId: z.uuid().nullable(),
});
export type EconomyState = z.infer<typeof EconomyStateSchema>;

export const ClaimFreePackRequestSchema = z.object({ realm: RealmSchema });
export type ClaimFreePackRequest = z.infer<typeof ClaimFreePackRequestSchema>;

export const BuyPacksRequestSchema = z.object({
  packTypeId: PackTypeIdSchema,
  quantity: z.int().min(1).max(MAX_PACKS_PER_PURCHASE).default(1),
  idempotencyKey: IdempotencyKeySchema,
});
export type BuyPacksRequest = z.input<typeof BuyPacksRequestSchema>;
export type BuyPacksInput = z.output<typeof BuyPacksRequestSchema>;

export const OpenPackRequestSchema = z.object({
  packTypeId: PackTypeIdSchema,
  idempotencyKey: IdempotencyKeySchema,
});
export type OpenPackRequest = z.infer<typeof OpenPackRequestSchema>;

/** A pulled card as stored with the opening: the roll plus the copy it created. */
export const OpenedCardSchema = RolledCardSchema.extend({
  userCardId: z.uuid(),
  mintNumber: z.int().min(1).nullable(),
  edition: EditionStampSchema.nullable(),
  /** The player owned no copy of this card before this pack. */
  isNew: z.boolean(),
});
export type OpenedCard = z.infer<typeof OpenedCardSchema>;

export const PackOpeningSchema = z.object({
  id: z.uuid(),
  packTypeId: PackTypeIdSchema,
  scripted: z.boolean(),
  pityTrigger: PityTriggerSchema,
  /** Cards in slot order. */
  cards: z.array(OpenedCardSchema).length(5),
  /** Slots in reveal order (ascending rarity, featured last). */
  revealOrder: z.array(z.int().min(1).max(5)).length(5),
  createdAt: z.iso.datetime(),
  revealedAt: z.iso.datetime().nullable(),
});
export type PackOpening = z.infer<typeof PackOpeningSchema>;

export const OpenPackResponseSchema = z.object({
  opening: PackOpeningSchema,
  /** True when this key was already used and the stored result is returned. */
  replayed: z.boolean(),
});
export type OpenPackResponse = z.infer<typeof OpenPackResponseSchema>;

export const PendingOpeningResponseSchema = z.object({ opening: PackOpeningSchema.nullable() });

export const PullHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** `nextCursor` of the previous page. */
  cursor: z.string().max(100).optional(),
});
export const PullHistoryResponseSchema = z.object({
  openings: z.array(PackOpeningSchema),
  nextCursor: z.string().nullable(),
});
export type PullHistoryResponse = z.infer<typeof PullHistoryResponseSchema>;

const WeightsSchema = z.record(z.string(), z.number());
export const PackOddsSchema = z.object({
  packTypeId: PackTypeIdSchema,
  price: z.object({ currency: CurrencySchema, amount: z.int() }),
  enabled: z.boolean(),
  pityGroup: PityGroupSchema,
  /** Chances in percent. */
  slotRarity: WeightsSchema,
  featuredRarity: WeightsSchema,
  variants: WeightsSchema,
  ownRealmPercent: z.number().nullable(),
  pity: z.object({
    legendaryHardPity: z.int(),
    mythicSoftPityStart: z.int().nullable(),
    mythicSoftPityStepPercent: z.number(),
    mythicHardPity: z.int(),
  }),
});
export const OddsResponseSchema = z.object({ packs: z.array(PackOddsSchema) });
export type OddsResponse = z.infer<typeof OddsResponseSchema>;

export const DustRequestSchema = z.object({
  userCardIds: z.array(z.uuid()).min(1).max(200),
});
export const DustResponseSchema = z.object({
  dusted: z.int().min(0),
  dust: z.int().min(0),
  wallet: WalletSchema,
});
export type DustResponse = z.infer<typeof DustResponseSchema>;

export const DustExtrasPreviewSchema = z.object({
  copies: z.array(
    z.object({
      userCardId: z.uuid(),
      cardId: CardIdSchema,
      rarity: RaritySchema,
      variant: VariantSchema,
    }),
  ),
  dust: z.int().min(0),
});
export type DustExtrasPreview = z.infer<typeof DustExtrasPreviewSchema>;
