import { Queue, Worker } from 'bullmq';
import { ConnectionOptions } from 'bullmq';
import { lte, asc } from 'drizzle-orm';
import { Db, products, QUEUES } from '@liskobot/shared';
import type { AmazonScrapeJob } from '@liskobot/shared';
export { calculateNextCheckInterval } from '@liskobot/shared';

export function calculatePriority(subscriberCount: number, volatilityScore: number): number {
  return Math.log10(subscriberCount + 1) * (volatilityScore + 0.1);
}

export function registerScheduler(connection: ConnectionOptions, db: Db) {
  const amazonScrapeQueue = new Queue(QUEUES.AMAZON_SCRAPE, { connection });

  // Repeatable job: fires every minute to check for due products
  const priceCheckQueue = new Queue(QUEUES.PRICE_CHECK, { connection });
  priceCheckQueue.upsertJobScheduler('price-check-scheduler', {
    every: 60_000,
  }, {
    name: 'price-check',
  });

  const worker = new Worker(
    QUEUES.PRICE_CHECK,
    async () => {
      const dueProducts = await db
        .select()
        .from(products)
        .where(lte(products.nextCheckAt, new Date()))
        .orderBy(asc(products.nextCheckAt))
        .limit(50);

      for (const product of dueProducts) {
        await amazonScrapeQueue.add(QUEUES.AMAZON_SCRAPE, {
          asin: product.asin,
          currentPrice: product.currentPrice,
        } satisfies AmazonScrapeJob);
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`Scheduler job ${job?.id} failed:`, err.message);
  });

  return { worker, priceCheckQueue, amazonScrapeQueue };
}
