import { createBot } from './bot.js';
import { createDb } from '@liskobot/shared';
import { config } from './config.js';

async function main() {
  const db = createDb(config.databaseUrl);
  const bot = createBot(config.telegramBotToken, db);
  await bot.start();
  console.log('Bot service started');
}

main().catch(console.error);
