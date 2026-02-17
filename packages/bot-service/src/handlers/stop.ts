import { Context } from 'grammy';
import { eq, and, sql } from 'drizzle-orm';
import { Db, watches, products } from '@liskobot/shared';

export function createStopHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    const asin = ctx.match as string | undefined;
    if (!chatId || !ownerUserId || !asin) {
      await ctx.reply('Usage: /stop <ASIN>');
      return;
    }

    const upperAsin = asin.toUpperCase();

    // Delete the watch
    const deleted = await db
      .delete(watches)
      .where(
        and(
          eq(watches.telegramChatId, chatId),
          eq(watches.ownerUserId, ownerUserId),
          eq(watches.asin, upperAsin),
        ),
      )
      .returning({ asin: watches.asin });

    if (deleted.length === 0) {
      await ctx.reply(`No watch found for ${upperAsin}.`);
      return;
    }

    // Decrement subscriber count for the removed watch.
    await db
      .update(products)
      .set({ subscriberCount: sql`GREATEST(COALESCE(${products.subscriberCount}, 0) - 1, 0)` })
      .where(eq(products.asin, upperAsin));

    await ctx.reply(`Stopped tracking ${upperAsin}.`);
  };
}
