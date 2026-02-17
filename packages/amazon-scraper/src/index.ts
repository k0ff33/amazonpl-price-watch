import { createServer } from 'node:http';
import { Worker, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { createDb, parseRedisUrl, QUEUES, products, priceHistory } from '@liskobot/shared';
import type { AmazonScrapeJob, PriceChangedJob, CeneoVerifyJob } from '@liskobot/shared';
import { config } from './config.js';
import { createAmazonCrawler } from './crawler.js';
import { analyzePriceChange } from './price-processor.js';
import { scrapeWithFallback } from './scrape-with-fallback.js';

async function main() {
  const db = createDb(config.databaseUrl);
  const connection = parseRedisUrl(config.redisUrl);

  const priceChangedQueue = new Queue<PriceChangedJob>(QUEUES.PRICE_CHANGED, { connection });
  const ceneoVerifyQueue = new Queue<CeneoVerifyJob>(QUEUES.CENEO_VERIFY, { connection });

  const directScraper = createAmazonCrawler();
  const proxyScraper = config.proxyUrl ? createAmazonCrawler(config.proxyUrl) : undefined;

  const worker = new Worker<AmazonScrapeJob>(
    QUEUES.AMAZON_SCRAPE,
    async (job) => {
      const { asin } = job.data;
      const url = `https://www.amazon.pl/dp/${asin}`;

      const { result: scrapeResult, usedProxyFallback } = await scrapeWithFallback({
        asin,
        url,
        direct: directScraper,
        proxy: proxyScraper,
      });

      if (usedProxyFallback) {
        console.warn(`ASIN ${asin}: direct scrape blocked, proxy fallback used`);
      }

      // If blocked by CAPTCHA, enqueue ceneo-verify for cross-check
      if (scrapeResult.blocked) {
        const product = await db.query.products.findFirst({
          where: eq(products.asin, asin),
        });
        if (product) {
          await ceneoVerifyQueue.add('ceneo-verify', {
            asin,
            title: product.title,
            expectedPrice: product.currentPrice ?? '0',
            ceneoId: product.ceneoId,
            reason: 'amazon_blocked',
          });
        }
        console.warn(`ASIN ${asin}: blocked by CAPTCHA, dispatched ceneo-verify`);
        return;
      }

      // Look up the product in DB
      const product = await db.query.products.findFirst({
        where: eq(products.asin, asin),
      });

      if (!product) {
        console.warn(`ASIN ${asin}: product not found in DB, skipping`);
        return;
      }

      const oldPrice = product.currentPrice ?? null;
      const newPrice = scrapeResult.price;

      // If we couldn't extract a price, just update lastScrapedAt
      if (!newPrice) {
        await db
          .update(products)
          .set({
            isInStock: scrapeResult.isInStock,
            lastScrapedAt: new Date(),
            ...(scrapeResult.title && { title: scrapeResult.title }),
          })
          .where(eq(products.asin, asin));
        console.log(`ASIN ${asin}: no price extracted, updated metadata`);
        return;
      }

      // Analyze price change
      const change = analyzePriceChange(oldPrice, newPrice, product.historicalLow ?? null);

      // Compute new historical low
      const newHistoricalLow = change.isHistoricalLow ? newPrice : (product.historicalLow ?? newPrice);

      // Update products table
      await db
        .update(products)
        .set({
          currentPrice: newPrice,
          historicalLow: newHistoricalLow,
          isInStock: scrapeResult.isInStock,
          lastScrapedAt: new Date(),
          ...(scrapeResult.title && { title: scrapeResult.title }),
        })
        .where(eq(products.asin, asin));

      // Insert price history record
      await db.insert(priceHistory).values({
        asin,
        price: newPrice,
        source: 'amazon_scraper',
      });

      console.log(
        `ASIN ${asin}: ${change.type} (${oldPrice ?? 'null'} -> ${newPrice}, drop=${change.dropPercent.toFixed(1)}%, histLow=${change.isHistoricalLow})`,
      );

      // Enqueue jobs based on analysis
      if (change.type === 'normal_drop' || change.type === 'anomalous_drop' || change.type === 'first_price') {
        const isAnomalous = change.type === 'anomalous_drop';

        await priceChangedQueue.add('price-changed', {
          asin,
          oldPrice,
          newPrice,
          source: 'amazon_scraper',
          isInStock: scrapeResult.isInStock,
          unverified: isAnomalous,
        });

        // If anomalous drop, also enqueue ceneo verification
        if (isAnomalous) {
          await ceneoVerifyQueue.add('ceneo-verify', {
            asin,
            title: scrapeResult.title ?? product.title,
            expectedPrice: newPrice,
            ceneoId: product.ceneoId,
            reason: 'anomalous_drop',
          });
          console.warn(`ASIN ${asin}: anomalous drop detected (${change.dropPercent.toFixed(1)}%), dispatched ceneo-verify`);
        }
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200);
      res.end('ok');
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(3001);

  console.log('Amazon scraper started');
}

main().catch(console.error);
