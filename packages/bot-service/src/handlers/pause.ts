import { Context } from 'grammy';
import { Db } from '@liskobot/shared';
import { pauseWatch } from './chat-actions.js';

export function createPauseHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    const asin = (ctx.match as string | undefined)?.trim();
    if (!chatId || !ownerUserId || !asin) {
      await ctx.reply('Usage: /pause <ASIN>');
      return;
    }

    const paused = await pauseWatch(db, chatId, ownerUserId, asin);

    if (!paused) {
      await ctx.reply(`No watch found for ${asin.toUpperCase()}.`);
      return;
    }

    await ctx.reply(`Paused tracking for ${asin.toUpperCase()}.`);
  };
}
