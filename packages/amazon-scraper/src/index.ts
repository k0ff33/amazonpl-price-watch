import { Worker, Queue } from 'bullmq';
import { createDb, parseRedisUrl, QUEUES } from '@liskobot/shared';
import type { AmazonScrapeJob } from '@liskobot/shared';
import { config } from './config.js';
import { createAmazonCrawler } from './crawler.js';

async function main() {
  const db = createDb(config.databaseUrl);
  const connection = parseRedisUrl(config.redisUrl);

  const priceChangedQueue = new Queue(QUEUES.PRICE_CHANGED, { connection });
  const ceneoVerifyQueue = new Queue(QUEUES.CENEO_VERIFY, { connection });

  const { crawler } = createAmazonCrawler(config.proxyUrl);

  const worker = new Worker<AmazonScrapeJob>(
    QUEUES.AMAZON_SCRAPE,
    async (job) => {
      const { asin } = job.data;
      const url = `https://www.amazon.pl/dp/${asin}`;

      // Run crawl for single URL
      await crawler.run([{ url, userData: { asin } }]);

      // Result will be processed in Task 9 (price-processor)
      // For now, just log
      console.log(`Scraped ${asin}`);
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log('Amazon scraper started');
}

main().catch(console.error);
