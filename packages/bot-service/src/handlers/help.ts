import { Context } from 'grammy';

export function createHelpHandler() {
  return async (ctx: Context) => {
    await ctx.reply(
      [
        'Available commands:',
        '/track <url> - track an Amazon.pl product URL',
        '/list - show your watches',
        '/set <ASIN> <price> - set target price',
        '/pause <ASIN> - pause tracking',
        '/stop <ASIN> - stop tracking',
        '/help - show this help message',
        '',
        'Tip: you can also just paste an Amazon.pl URL directly.',
        'After tracking, shortcuts work too: set 199, pause, stop.',
      ].join('\n'),
    );
  };
}
