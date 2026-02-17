import { Bot } from 'grammy';
import { Db } from '@liskobot/shared';
import { createTrackHandler } from './handlers/track.js';
import { createListHandler } from './handlers/list.js';
import { createPauseHandler } from './handlers/pause.js';
import { createStopHandler } from './handlers/stop.js';
import { createSetHandler } from './handlers/set.js';

export function createBot(token: string, db: Db) {
  const bot = new Bot(token);

  bot.command('start', (ctx) =>
    ctx.reply('Send me an Amazon.pl product URL and I\'ll track the price for you.')
  );

  bot.command('list', createListHandler(db));
  bot.command('pause', createPauseHandler(db));
  bot.command('stop', createStopHandler(db));
  bot.command('set', createSetHandler(db));

  // Handle Amazon URL pastes for tracking
  bot.on('message:text', createTrackHandler(db));

  return bot;
}
