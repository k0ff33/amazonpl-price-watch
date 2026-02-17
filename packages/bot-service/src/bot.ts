import { Bot } from 'grammy';
import { Db } from '@liskobot/shared';
import { createTrackHandler } from './handlers/track.js';

export function createBot(token: string, db: Db) {
  const bot = new Bot(token);

  bot.command('start', (ctx) =>
    ctx.reply('Send me an Amazon.pl product URL and I\'ll track the price for you.')
  );

  bot.command('list', (ctx) => ctx.reply('No watches yet.')); // placeholder
  bot.command('pause', (ctx) => ctx.reply('Not implemented yet.'));
  bot.command('stop', (ctx) => ctx.reply('Not implemented yet.'));
  bot.command('set', (ctx) => ctx.reply('Not implemented yet.'));

  // Handle Amazon URL pastes for tracking
  bot.on('message:text', createTrackHandler(db));

  return bot;
}
