ALTER TABLE "watches" ADD COLUMN "owner_user_id" bigint;--> statement-breakpoint
UPDATE "watches"
SET "owner_user_id" = "telegram_chat_id"
WHERE "owner_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "watches" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
DELETE FROM "watches" a
USING "watches" b
WHERE a.ctid < b.ctid
  AND a.telegram_chat_id = b.telegram_chat_id
  AND a.owner_user_id = b.owner_user_id
  AND a.asin = b.asin;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_watches_chat_owner_asin" ON "watches" USING btree ("telegram_chat_id","owner_user_id","asin");--> statement-breakpoint
CREATE INDEX "idx_watches_owner_active" ON "watches" USING btree ("owner_user_id","is_active");
