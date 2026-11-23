CREATE TABLE "email_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"onboarding_step" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"set" text NOT NULL,
	"name" text NOT NULL,
	"realm" text NOT NULL,
	"rarity" text NOT NULL,
	"atk" integer NOT NULL,
	"hp" integer NOT NULL,
	"abilities" jsonb NOT NULL,
	"flavour" text NOT NULL,
	"event" boolean NOT NULL,
	"craftable" boolean NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"claim_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"currency" text,
	"delta" integer DEFAULT 0 NOT NULL,
	"user_card_id" uuid,
	"pack_type_id" text,
	"reason" text NOT NULL,
	"ref_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mint_counters" (
	"card_id" text NOT NULL,
	"variant" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mint_counters_card_id_variant_pk" PRIMARY KEY("card_id","variant")
);
--> statement-breakpoint
CREATE TABLE "pack_inventory" (
	"user_id" uuid NOT NULL,
	"pack_type_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pack_inventory_user_id_pack_type_id_pk" PRIMARY KEY("user_id","pack_type_id"),
	CONSTRAINT "pack_inventory_non_negative" CHECK ("pack_inventory"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pack_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pack_type_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"scripted" boolean NOT NULL,
	"pity_trigger" text,
	"mythic_soft_pity_bonus" integer DEFAULT 0 NOT NULL,
	"cards" jsonb NOT NULL,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_types" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"realm" text,
	"pity_group" text NOT NULL,
	"release_season" integer NOT NULL,
	"enabled" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pity_counters" (
	"user_id" uuid NOT NULL,
	"pity_group" text NOT NULL,
	"packs_since_legendary_plus" integer DEFAULT 0 NOT NULL,
	"packs_since_mythic" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pity_counters_user_id_pity_group_pk" PRIMARY KEY("user_id","pity_group")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"variant" text NOT NULL,
	"stars" smallint DEFAULT 1 NOT NULL,
	"edition_season" integer,
	"mint_number" integer,
	"source" text NOT NULL,
	"pack_opening_id" uuid,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trade_lock_until" timestamp with time zone,
	"account_bound" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_cards_stars" CHECK ("user_cards"."stars" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"dust" integer DEFAULT 0 NOT NULL,
	"gems" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_non_negative" CHECK ("wallets"."gold" >= 0 and "wallets"."dust" >= 0 and "wallets"."gems" >= 0)
);
--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_claims" ADD CONSTRAINT "daily_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_card_id_user_cards_id_fk" FOREIGN KEY ("user_card_id") REFERENCES "public"."user_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_pack_type_id_pack_types_id_fk" FOREIGN KEY ("pack_type_id") REFERENCES "public"."pack_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mint_counters" ADD CONSTRAINT "mint_counters_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_inventory" ADD CONSTRAINT "pack_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_inventory" ADD CONSTRAINT "pack_inventory_pack_type_id_pack_types_id_fk" FOREIGN KEY ("pack_type_id") REFERENCES "public"."pack_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_openings" ADD CONSTRAINT "pack_openings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_openings" ADD CONSTRAINT "pack_openings_pack_type_id_pack_types_id_fk" FOREIGN KEY ("pack_type_id") REFERENCES "public"."pack_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_types" ADD CONSTRAINT "pack_types_release_season_seasons_id_fk" FOREIGN KEY ("release_season") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pity_counters" ADD CONSTRAINT "pity_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_edition_season_seasons_id_fk" FOREIGN KEY ("edition_season") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_pack_opening_id_pack_openings_id_fk" FOREIGN KEY ("pack_opening_id") REFERENCES "public"."pack_openings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_tokens_user_purpose_idx" ON "email_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_uq" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "daily_claims_uq" ON "daily_claims" USING btree ("user_id","kind","claim_key");--> statement-breakpoint
CREATE INDEX "ledger_user_created_idx" ON "ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_openings_idempotency_uq" ON "pack_openings" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "pack_openings_user_created_idx" ON "pack_openings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_cards_user_card_idx" ON "user_cards" USING btree ("user_id","card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_cards_mint_uq" ON "user_cards" USING btree ("card_id","variant","mint_number") WHERE "user_cards"."mint_number" is not null;--> statement-breakpoint
INSERT INTO "seasons" ("id", "name", "starts_at") VALUES (0, 'Season 0', '2026-11-23T00:00:00Z') ON CONFLICT DO NOTHING;
