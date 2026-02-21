CREATE INDEX "idx_products_next_check" ON "products" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "idx_watches_asin_active" ON "watches" USING btree ("asin","is_active");--> statement-breakpoint
CREATE INDEX "idx_watches_chat_owner" ON "watches" USING btree ("telegram_chat_id","owner_user_id");