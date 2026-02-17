import { Bot } from 'grammy';

export function createBot(token: string) {
  const bot = new Bot(token);

  bot.command('start', (ctx) =>
    ctx.reply('Send me an Amazon.pl product URL and I\'ll track the price for you.')
  );

  bot.command('list', (ctx) => ctx.reply('No watches yet.')); // placeholder
  bot.command('pause', (ctx) => ctx.reply('Not implemented yet.'));
  bot.command('stop', (ctx) => ctx.reply('Not implemented yet.'));
  bot.command('set', (ctx) => ctx.reply('Not implemented yet.'));

  return bot;
}
