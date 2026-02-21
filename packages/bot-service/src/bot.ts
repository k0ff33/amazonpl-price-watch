import { Bot } from 'grammy';
import type { Redis } from 'ioredis';
import { Db } from '@liskobot/shared';
import { createTrackHandler } from './handlers/track.js';
import { createListHandler } from './handlers/list.js';
import { createPauseHandler } from './handlers/pause.js';
import { createStopHandler } from './handlers/stop.js';
import { createSetHandler } from './handlers/set.js';
import { createHelpHandler } from './handlers/help.js';
import { createCallbackQueryHandler, createNaturalInputHandler, createPendingPriceHandler } from './handlers/interactive.js';
import { createInteractionState } from './interaction-state.js';

export function createBot(token: string, db: Db, redis: Redis) {
  const bot = new Bot(token);
  const state = createInteractionState(redis);
  const trackHandler = createTrackHandler(db, state);
  const pendingPriceHandler = createPendingPriceHandler(db, state);
  const naturalInputHandler = createNaturalInputHandler(db, state);

  bot.command('start', (ctx) =>
    ctx.reply('Send me an Amazon.pl product URL and I\'ll track the price for you. Type /help for commands.')
  );

  bot.command('help', createHelpHandler());
  bot.command('track', trackHandler);
  bot.command('list', createListHandler(db));
  bot.command('pause', createPauseHandler(db));
  bot.command('stop', createStopHandler(db));
  bot.command('set', createSetHandler(db));

  bot.on('callback_query:data', createCallbackQueryHandler(db, state));

  bot.on('message:text', async (ctx) => {
    const handledPendingPrice = await pendingPriceHandler(ctx);
    if (handledPendingPrice) return;

    const handledNaturalInput = await naturalInputHandler(ctx);
    if (handledNaturalInput) return;

    await trackHandler(ctx);
  });

  return bot;
}
