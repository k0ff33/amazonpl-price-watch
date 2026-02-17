import { createServer } from 'node:http';
import { Worker } from 'bullmq';
import { createBot } from './bot.js';
import { createDb, parseRedisUrl, QUEUES } from '@liskobot/shared';
import type { NotifyUserJob } from '@liskobot/shared';
import { config } from './config.js';
import { registerScheduler } from './scheduler.js';
import { registerPriceChangedHandler } from './handlers/price-changed.js';
import { registerCeneoResultHandler } from './handlers/ceneo-result.js';

async function main() {
  const db = createDb(config.databaseUrl);
  const connection = parseRedisUrl(config.redisUrl);

  const bot = createBot(config.telegramBotToken, db);

  // Register BullMQ workers
  registerScheduler(connection, db);
  registerPriceChangedHandler(connection, db, config.adminChatId, config.amazonAssociateTag);
  registerCeneoResultHandler(connection, db, config.adminChatId);

  // Notify-user worker: sends Telegram messages
  const notifyWorker = new Worker<NotifyUserJob>(
    QUEUES.NOTIFY_USER,
    async (job) => {
      const { telegramChatId, message } = job.data;
      await bot.api.sendMessage(telegramChatId, message, { parse_mode: 'Markdown' });
    },
    { connection, concurrency: 5 },
  );

  notifyWorker.on('failed', (job, err) => {
    console.error(`Notify job ${job?.id} failed:`, err.message);
  });

  createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200);
      res.end('ok');
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(3000);

  await bot.start();
  console.log('Bot service started');
}

main().catch(console.error);
