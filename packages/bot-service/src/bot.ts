import { Bot } from 'grammy';
import { Db } from '@liskobot/shared';
import { createTrackHandler } from './handlers/track.js';
import { createListHandler } from './handlers/list.js';
import { createPauseHandler } from './handlers/pause.js';
import { createStopHandler } from './handlers/stop.js';
import { createSetHandler } from './handlers/set.js';
import { createHelpHandler } from './handlers/help.js';
import { createCallbackQueryHandler, createNaturalInputHandler, createPendingPriceHandler } from './handlers/interactive.js';

export function createBot(token: string, db: Db) {
  const bot = new Bot(token);
  const trackHandler = createTrackHandler(db);
  const pendingPriceHandler = createPendingPriceHandler(db);
  const naturalInputHandler = createNaturalInputHandler(db);

  bot.command('start', (ctx) =>
    ctx.reply('Send me an Amazon.pl product URL and I\'ll track the price for you. Type /help for commands.')
  );

  bot.command('help', createHelpHandler());
  bot.command('track', trackHandler);
  bot.command('list', createListHandler(db));
  bot.command('pause', createPauseHandler(db));
  bot.command('stop', createStopHandler(db));
  bot.command('set', createSetHandler(db));

  bot.on('callback_query:data', createCallbackQueryHandler(db));

  bot.on('message:text', async (ctx) => {
    const handledPendingPrice = await pendingPriceHandler(ctx);
    if (handledPendingPrice) return;

    const handledNaturalInput = await naturalInputHandler(ctx);
    if (handledNaturalInput) return;

    await trackHandler(ctx);
  });

  return bot;
}
