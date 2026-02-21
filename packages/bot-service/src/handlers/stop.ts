import { Context } from 'grammy';
import { Db } from '@liskobot/shared';
import { stopWatch } from './chat-actions.js';

export function createStopHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    const asin = (ctx.match as string | undefined)?.trim();
    if (!chatId || !ownerUserId || !asin) {
      await ctx.reply('Usage: /stop <ASIN>');
      return;
    }

    const stopped = await stopWatch(db, chatId, ownerUserId, asin);

    if (!stopped) {
      await ctx.reply(`No watch found for ${asin.toUpperCase()}.`);
      return;
    }

    await ctx.reply(`Stopped tracking ${asin.toUpperCase()}.`);
  };
}
