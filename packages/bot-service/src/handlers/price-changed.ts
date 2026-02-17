import { Worker, Queue, ConnectionOptions } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { Db, watches, products, QUEUES } from '@liskobot/shared';
import type { PriceChangedJob, NotifyUserJob } from '@liskobot/shared';
import { formatPriceAlert, formatAdminAlert } from '../notifications.js';
import { calculateNextCheckInterval } from '../scheduler.js';

export function registerPriceChangedHandler(
  connection: ConnectionOptions,
  db: Db,
  adminChatId: number,
  associateTag: string,
) {
  const notifyQueue = new Queue(QUEUES.NOTIFY_USER, { connection });

  const worker = new Worker<PriceChangedJob>(
    QUEUES.PRICE_CHANGED,
    async (job) => {
      const { asin, oldPrice, newPrice, unverified, isInStock } = job.data;

      const activeWatches = await db
        .select()
        .from(watches)
        .where(and(eq(watches.asin, asin), eq(watches.isActive, true)));

      const product = await db.query.products.findFirst({
        where: eq(products.asin, asin),
      });

      if (!product) return;

      for (const watch of activeWatches) {
        const targetMet = watch.targetPrice && parseFloat(newPrice) <= parseFloat(watch.targetPrice);
        const isHistLow = product.historicalLow && parseFloat(newPrice) < parseFloat(product.historicalLow);
        const priceDrop = oldPrice && parseFloat(newPrice) < parseFloat(oldPrice);

        if (targetMet || (isHistLow && watch.notifyHistoricalLow) || priceDrop) {
          const message = formatPriceAlert({
            title: product.title,
            asin,
            oldPrice,
            newPrice,
            isHistoricalLow: !!isHistLow,
            unverified,
            associateTag,
          });

          await notifyQueue.add(QUEUES.NOTIFY_USER, {
            telegramChatId: watch.telegramChatId,
            message,
          } satisfies NotifyUserJob);
        }
      }

      // Notify admin on unverified drops
      if (unverified) {
        await notifyQueue.add(QUEUES.NOTIFY_USER, {
          telegramChatId: adminChatId,
          message: formatAdminAlert(asin, product.title, oldPrice, newPrice, 'anomalous_drop'),
        } satisfies NotifyUserJob);
      }

      // Recalculate next check interval
      const interval = calculateNextCheckInterval({
        price: parseFloat(newPrice),
        subscriberCount: product.subscriberCount ?? 0,
        volatilityScore: parseFloat(product.volatilityScore ?? '0'),
      });

      await db.update(products)
        .set({ nextCheckAt: new Date(Date.now() + interval * 60_000) })
        .where(eq(products.asin, asin));
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`Price-changed job ${job?.id} failed:`, err.message);
  });

  return { worker, notifyQueue };
}
