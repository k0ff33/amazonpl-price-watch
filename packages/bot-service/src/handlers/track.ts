import { Context } from 'grammy';
import { and, eq, sql } from 'drizzle-orm';
import { Db, products, watches } from '@liskobot/shared';
import { extractAsin } from '../asin.js';

const MAX_ACTIVE_WATCHES_PER_USER = 50;

export function createTrackHandler(db: Db) {
  return async (ctx: Context) => {
    const text = ctx.message?.text;
    if (!text) return;

    const asin = extractAsin(text);
    if (!asin) return; // not an Amazon URL, ignore

    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    if (!chatId || !ownerUserId) return;

    // Ensure product row exists (title populated later by scraper).
    await db
      .insert(products)
      .values({
        asin,
        title: `Product ${asin}`,
        nextCheckAt: new Date(),
      })
      .onConflictDoNothing({ target: products.asin });

    // Per-user quota to cap abuse and scraping cost.
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(watches)
      .where(and(
        eq(watches.ownerUserId, ownerUserId),
        eq(watches.isActive, true),
      ));
    const activeWatchCount = Number(countResult[0]?.count ?? 0);

    if (activeWatchCount >= MAX_ACTIVE_WATCHES_PER_USER) {
      await ctx.reply(
        `You've reached the maximum of ${MAX_ACTIVE_WATCHES_PER_USER} active watches. ` +
          'Use /stop <ASIN> to remove one before adding another.',
      );
      return;
    }

    // Upsert watch to avoid races between duplicate requests.
    const insertedWatch = await db
      .insert(watches)
      .values({
        telegramChatId: chatId,
        ownerUserId,
        asin,
      })
      .onConflictDoNothing({
        target: [watches.telegramChatId, watches.ownerUserId, watches.asin],
      })
      .returning({ id: watches.id });

    if (insertedWatch.length === 0) {
      await ctx.reply(`You're already tracking this product (${asin}).`);
      return;
    }

    // Update subscriber count only for newly-created watches.
    await db
      .update(products)
      .set({ subscriberCount: sql`COALESCE(${products.subscriberCount}, 0) + 1` })
      .where(eq(products.asin, asin));

    await ctx.reply(
      `Tracking ${asin}! I'll notify you when the price drops.\n` +
        `Use /set ${asin} <price> to set a target price.`,
    );
  };
}
