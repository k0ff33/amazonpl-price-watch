CREATE TABLE "price_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"asin" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"asin" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"current_price" numeric(10, 2),
	"historical_low" numeric(10, 2),
	"is_in_stock" boolean DEFAULT false,
	"ceneo_id" text,
	"volatility_score" numeric(5, 3) DEFAULT '0',
	"subscriber_count" bigint DEFAULT 0,
	"last_scraped_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_chat_id" bigint NOT NULL,
	"asin" text NOT NULL,
	"target_price" numeric(10, 2),
	"notify_historical_low" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_asin_products_asin_fk" FOREIGN KEY ("asin") REFERENCES "public"."products"("asin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_asin_products_asin_fk" FOREIGN KEY ("asin") REFERENCES "public"."products"("asin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_price_history_asin_recorded" ON "price_history" USING btree ("asin","recorded_at");