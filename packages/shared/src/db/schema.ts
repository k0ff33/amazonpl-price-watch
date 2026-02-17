import { pgTable, text, numeric, boolean, bigint, uuid, timestamp, bigserial, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  asin: text('asin').primaryKey(),
  title: text('title').notNull(),
  currentPrice: numeric('current_price', { precision: 10, scale: 2 }),
  historicalLow: numeric('historical_low', { precision: 10, scale: 2 }),
  isInStock: boolean('is_in_stock').default(false),
  ceneoId: text('ceneo_id'),
  volatilityScore: numeric('volatility_score', { precision: 5, scale: 3 }).default('0'),
  subscriberCount: bigint('subscriber_count', { mode: 'number' }).default(0),
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }),
  nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const watches = pgTable('watches', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).notNull(),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).notNull(),
  asin: text('asin').references(() => products.asin).notNull(),
  targetPrice: numeric('target_price', { precision: 10, scale: 2 }),
  notifyHistoricalLow: boolean('notify_historical_low').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ux_watches_chat_owner_asin').on(table.telegramChatId, table.ownerUserId, table.asin),
  index('idx_watches_owner_active').on(table.ownerUserId, table.isActive),
]);

export const priceHistory = pgTable('price_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  asin: text('asin').references(() => products.asin).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  source: text('source').notNull(), // 'creators_api' | 'amazon_scraper' | 'ceneo'
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_price_history_asin_recorded').on(table.asin, table.recordedAt),
]);
