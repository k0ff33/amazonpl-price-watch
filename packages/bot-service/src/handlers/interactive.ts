import { Context } from 'grammy';
import { Db } from '@liskobot/shared';
import type { InteractionState } from '../interaction-state.js';
import { pauseWatch, setTargetPriceForWatch, stopWatch } from './chat-actions.js';

const SET_TARGET_RE = /^(?:set|target|ustaw)\s+(\d+(?:[.,]\d{1,2})?)$/i;
const PAUSE_RE = /^(?:pause|pauza|wstrzymaj)$/i;
const STOP_RE = /^(?:stop|usu[nń])$/i;

function parsePrice(text: string): number | null {
  const price = parseFloat(text.replace(',', '.'));
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function createCallbackQueryHandler(db: Db, state: InteractionState) {
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
      await state.setPendingTargetPrice(chatId, ownerUserId, asin);
      await ctx.answerCallbackQuery({ text: 'Send target price now' });
      await ctx.reply(`Send target price for ${asin} (e.g. 199.99).`);
      return;
    }

    if (action === 'pause') {
      const paused = await pauseWatch(db, chatId, ownerUserId, asin);
      await state.clearPendingAction(chatId, ownerUserId);
      if (paused) await state.setLastTrackedAsin(chatId, ownerUserId, asin);
      await ctx.answerCallbackQuery({ text: paused ? 'Paused' : 'Watch not found' });
      await ctx.reply(paused ? `Paused tracking for ${asin}.` : `No watch found for ${asin}.`);
      return;
    }

    if (action === 'stop') {
      const stopped = await stopWatch(db, chatId, ownerUserId, asin);
      await state.clearPendingAction(chatId, ownerUserId);
      if (stopped) await state.setLastTrackedAsin(chatId, ownerUserId, asin);
      await ctx.answerCallbackQuery({ text: stopped ? 'Stopped' : 'Watch not found' });
      await ctx.reply(stopped ? `Stopped tracking ${asin}.` : `No watch found for ${asin}.`);
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Unsupported action.' });
  };
}

export function createPendingPriceHandler(db: Db, state: InteractionState) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!chatId || !ownerUserId || !text) return false;

    const pendingAsin = await state.getPendingTargetPrice(chatId, ownerUserId);
    if (!pendingAsin) return false;

    if (text.startsWith('/') || text.includes('amazon.pl/') || text.includes('amzn.eu/')) {
      await state.clearPendingAction(chatId, ownerUserId);
      return false;
    }

    const price = parsePrice(text);
    if (!price) {
      await ctx.reply(`Please send a valid price for ${pendingAsin}, e.g. 199.99`);
      return true;
    }

    const updated = await setTargetPriceForWatch(db, chatId, ownerUserId, pendingAsin, price);
    if (!updated) {
      await state.clearPendingAction(chatId, ownerUserId);
      await ctx.reply(`No watch found for ${pendingAsin}. Send the Amazon URL first.`);
      return true;
    }

    await state.clearPendingAction(chatId, ownerUserId);
    await state.setLastTrackedAsin(chatId, ownerUserId, pendingAsin);
    await ctx.reply(`Target price for ${pendingAsin} set to ${price.toFixed(2)} PLN.`);
    return true;
  };
}

export function createNaturalInputHandler(db: Db, state: InteractionState) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    if (!chatId || !ownerUserId || !text) return false;

    const asin = await state.getLastTrackedAsin(chatId, ownerUserId);
    if (!asin) return false;

    const setMatch = text.match(SET_TARGET_RE);
    if (setMatch) {
      const price = parsePrice(setMatch[1]);
      if (!price) {
        await ctx.reply(`Please send a valid price for ${asin}, e.g. 199.99`);
        return true;
      }

      const updated = await setTargetPriceForWatch(db, chatId, ownerUserId, asin, price);
      if (!updated) {
        await ctx.reply(`No watch found for ${asin}. Send the Amazon URL first.`);
        return true;
      }

      await state.clearPendingAction(chatId, ownerUserId);
      await ctx.reply(`Target price for ${asin} set to ${price.toFixed(2)} PLN.`);
      return true;
    }

    if (PAUSE_RE.test(text)) {
      const paused = await pauseWatch(db, chatId, ownerUserId, asin);
      await state.clearPendingAction(chatId, ownerUserId);
      if (paused) await state.setLastTrackedAsin(chatId, ownerUserId, asin);
      await ctx.reply(paused ? `Paused tracking for ${asin}.` : `No watch found for ${asin}.`);
      return true;
    }

    if (STOP_RE.test(text)) {
      const stopped = await stopWatch(db, chatId, ownerUserId, asin);
      await state.clearPendingAction(chatId, ownerUserId);
      if (stopped) await state.setLastTrackedAsin(chatId, ownerUserId, asin);
      await ctx.reply(stopped ? `Stopped tracking ${asin}.` : `No watch found for ${asin}.`);
      return true;
    }

    return false;
  };
}
