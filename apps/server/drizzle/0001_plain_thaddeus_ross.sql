CREATE TABLE "dev_odds_overrides" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"featured_rarity" text,
	"featured_variant" text,
	"remaining" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"pack_type_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"currency" text NOT NULL,
	"cost" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "removed_reason" text;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "free_pack_anchor" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "dev_odds_overrides" ADD CONSTRAINT "dev_odds_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_pack_type_id_pack_types_id_fk" FOREIGN KEY ("pack_type_id") REFERENCES "public"."pack_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pack_purchases_idempotency_uq" ON "pack_purchases" USING btree ("user_id","idempotency_key");