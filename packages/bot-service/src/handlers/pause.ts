import { Context } from 'grammy';
import { eq, and } from 'drizzle-orm';
import { Db, watches } from '@liskobot/shared';

export function createPauseHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const asin = ctx.match as string | undefined;
    if (!chatId || !asin) {
      await ctx.reply('Usage: /pause <ASIN>');
      return;
    }

    const result = await db
      .update(watches)
      .set({ isActive: false })
      .where(
        and(eq(watches.telegramChatId, chatId), eq(watches.asin, asin.toUpperCase())),
      );

    await ctx.reply(`Paused tracking for ${asin.toUpperCase()}.`);
  };
}
