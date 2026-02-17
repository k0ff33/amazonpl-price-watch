import { Context } from 'grammy';
import { eq, and } from 'drizzle-orm';
import { Db, watches } from '@liskobot/shared';

export function createSetHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const args = (ctx.match as string | undefined)?.trim();
    if (!chatId || !args) {
      await ctx.reply('Usage: /set <ASIN> <price>');
      return;
    }

    const parts = args.split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply('Usage: /set <ASIN> <price>');
      return;
    }

    const asin = parts[0].toUpperCase();
    const price = parseFloat(parts[1].replace(',', '.'));

    if (isNaN(price) || price <= 0) {
      await ctx.reply('Please provide a valid price (e.g. /set B0DEXAMPLE 199.99).');
      return;
    }

    const result = await db
      .update(watches)
      .set({ targetPrice: price.toFixed(2) })
      .where(
        and(eq(watches.telegramChatId, chatId), eq(watches.asin, asin)),
      )
      .returning({ id: watches.id });

    if (result.length === 0) {
      await ctx.reply(`No watch found for ${asin}. Send the Amazon URL first.`);
      return;
    }

    await ctx.reply(`Target price for ${asin} set to ${price.toFixed(2)} PLN.`);
  };
}
