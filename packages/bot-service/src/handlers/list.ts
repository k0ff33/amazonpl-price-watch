import { Context } from 'grammy';
import { and, eq } from 'drizzle-orm';
import { Db, watches, products } from '@liskobot/shared';

export function createListHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    if (!chatId || !ownerUserId) return;

    const userWatches = await db
      .select({
        asin: watches.asin,
        targetPrice: watches.targetPrice,
        isActive: watches.isActive,
        title: products.title,
        currentPrice: products.currentPrice,
      })
      .from(watches)
      .innerJoin(products, eq(watches.asin, products.asin))
      .where(and(
        eq(watches.telegramChatId, chatId),
        eq(watches.ownerUserId, ownerUserId),
      ));

    if (userWatches.length === 0) {
      await ctx.reply('No active watches. Send an Amazon.pl URL to start tracking.');
      return;
    }

    const lines = userWatches.map((w) => {
      const status = w.isActive ? '' : ' (paused)';
      const price = w.currentPrice ? `${w.currentPrice} PLN` : 'checking...';
      const target = w.targetPrice ? ` | target: ${w.targetPrice} PLN` : '';
      return `${w.asin}: ${w.title}\n  ${price}${target}${status}`;
    });

    await ctx.reply(`Your watches:\n\n${lines.join('\n\n')}`);
  };
}
