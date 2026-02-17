import { Context } from 'grammy';
import { eq } from 'drizzle-orm';
import { Db, products, watches } from '@liskobot/shared';
import { extractAsin } from '../asin.js';

export function createTrackHandler(db: Db) {
  return async (ctx: Context) => {
    const text = ctx.message?.text;
    if (!text) return;

    const asin = extractAsin(text);
    if (!asin) return; // not an Amazon URL, ignore

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Upsert product (title will be populated by scraper)
    const existing = await db.query.products.findFirst({
      where: eq(products.asin, asin),
    });

    if (!existing) {
      await db.insert(products).values({
        asin,
        title: `Product ${asin}`, // placeholder until scraped
        nextCheckAt: new Date(), // schedule immediate check
      });
    }

    // Check for existing watch
    const existingWatch = await db.query.watches.findFirst({
      where: (w, { and }) =>
        and(eq(w.telegramChatId, chatId), eq(w.asin, asin)),
    });

    if (existingWatch) {
      await ctx.reply(`You're already tracking this product (${asin}).`);
      return;
    }

    // Create watch
    await db.insert(watches).values({
      telegramChatId: chatId,
      asin,
    });

    // Update subscriber count
    await db
      .update(products)
      .set({ subscriberCount: (existing?.subscriberCount ?? 0) + 1 })
      .where(eq(products.asin, asin));

    await ctx.reply(
      `Tracking ${asin}! I'll notify you when the price drops.\n` +
        `Use /set ${asin} <price> to set a target price.`,
    );
  };
}
