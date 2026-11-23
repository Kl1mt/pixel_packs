ALTER TABLE "users" ADD COLUMN "onboarding_stage" text DEFAULT 'courier' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "starter_cards_at" timestamp with time zone;