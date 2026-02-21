import { Context } from 'grammy';
import { Db } from '@liskobot/shared';
import { clearPendingAction, getPendingTargetPrice, setPendingTargetPrice } from '../interaction-state.js';
import { pauseWatch, setTargetPriceForWatch, stopWatch } from './chat-actions.js';

export function createCallbackQueryHandler(db: Db) {
  return async (ctx: Context) => {
    const payload = ctx.callbackQuery?.data;
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;

    if (!payload || !chatId || !ownerUserId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const [action, rawAsin] = payload.split(':');
    const asin = rawAsin?.toUpperCase();
    if (!asin) {
      await ctx.answerCallbackQuery({ text: 'Invalid action.' });
      return;
    }

    if (action === 'set_target') {
      setPendingTargetPrice(chatId, ownerUserId, asin);
      await ctx.answerCallbackQuery({ text: 'Send target price now' });
      await ctx.reply(`Send target price for ${asin} (e.g. 199.99).`);
      return;
    }

    if (action === 'pause') {
      const paused = await pauseWatch(db, chatId, ownerUserId, asin);
      await ctx.answerCallbackQuery({ text: paused ? 'Paused' : 'Watch not found' });
      await ctx.reply(paused ? `Paused tracking for ${asin}.` : `No watch found for ${asin}.`);
      return;
    }

    if (action === 'stop') {
      const stopped = await stopWatch(db, chatId, ownerUserId, asin);
      clearPendingAction(chatId, ownerUserId);
      await ctx.answerCallbackQuery({ text: stopped ? 'Stopped' : 'Watch not found' });
      await ctx.reply(stopped ? `Stopped tracking ${asin}.` : `No watch found for ${asin}.`);
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Unsupported action.' });
  };
}

export function createPendingPriceHandler(db: Db) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!chatId || !ownerUserId || !text) return false;

    const pendingAsin = getPendingTargetPrice(chatId, ownerUserId);
    if (!pendingAsin) return false;

    const price = parseFloat(text.replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      await ctx.reply(`Please send a valid price for ${pendingAsin}, e.g. 199.99`);
      return true;
    }

    const updated = await setTargetPriceForWatch(db, chatId, ownerUserId, pendingAsin, price);
    if (!updated) {
      clearPendingAction(chatId, ownerUserId);
      await ctx.reply(`No watch found for ${pendingAsin}. Send the Amazon URL first.`);
      return true;
    }

    clearPendingAction(chatId, ownerUserId);
    await ctx.reply(`Target price for ${pendingAsin} set to ${price.toFixed(2)} PLN.`);
    return true;
  };
}
