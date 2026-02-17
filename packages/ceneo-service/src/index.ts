import { Worker, Queue } from 'bullmq';
import { createDb, parseRedisUrl, QUEUES, products } from '@liskobot/shared';
import type { CeneoVerifyJob, CeneoResultJob } from '@liskobot/shared';
import { config } from './config.js';
import { createCeneoCrawler } from './crawler.js';
import { eq } from 'drizzle-orm';

async function main() {
  const db = createDb(config.databaseUrl);
  const connection = parseRedisUrl(config.redisUrl);
  const ceneoResultQueue = new Queue(QUEUES.CENEO_RESULT, { connection });
  const { crawler, results } = createCeneoCrawler();

  const worker = new Worker<CeneoVerifyJob>(
    QUEUES.CENEO_VERIFY,
    async (job) => {
      const { asin, title, expectedPrice, ceneoId, reason } = job.data;

      // Determine URL: use cached ceneoId or search by title
      let url: string;
      if (ceneoId) {
        url = `https://www.ceneo.pl/${ceneoId}`;
      } else {
        const searchQuery = encodeURIComponent(title);
        url = `https://www.ceneo.pl/szukaj-${searchQuery}`;
      }

      await crawler.run([{ url, userData: { asin, expectedPrice } }]);

      const result = results.get(asin);
      results.delete(asin);

      const confirmed = result?.amazonFound && result?.ceneoPrice
        ? Math.abs(parseFloat(result.ceneoPrice) - parseFloat(expectedPrice)) < 1
        : false;

      // If we found a ceneoId from search, cache it
      if (ceneoId) {
        await db.update(products).set({ ceneoId }).where(eq(products.asin, asin));
      }

      await ceneoResultQueue.add(QUEUES.CENEO_RESULT, {
        asin,
        confirmed,
        ceneoPrice: result?.ceneoPrice ?? null,
        ceneoId: ceneoId ?? null,
      } satisfies CeneoResultJob);
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.error(`Ceneo job ${job?.id} failed:`, err.message);
  });

  console.log('Ceneo service started');
}

main().catch(console.error);
