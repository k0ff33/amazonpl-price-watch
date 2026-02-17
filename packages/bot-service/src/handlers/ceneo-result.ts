import { Worker, Queue, ConnectionOptions } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { Db, watches, products, QUEUES } from '@liskobot/shared';
import type { CeneoResultJob, NotifyUserJob } from '@liskobot/shared';

export function registerCeneoResultHandler(
  connection: ConnectionOptions,
  db: Db,
  adminChatId: number,
) {
  const notifyQueue = new Queue(QUEUES.NOTIFY_USER, { connection });

  const worker = new Worker<CeneoResultJob>(
    QUEUES.CENEO_RESULT,
    async (job) => {
      const { asin, confirmed, ceneoPrice, ceneoId } = job.data;

      // Cache ceneoId for future lookups
      if (ceneoId) {
        await db.update(products).set({ ceneoId }).where(eq(products.asin, asin));
      }

      const product = await db.query.products.findFirst({
        where: eq(products.asin, asin),
      });

      if (!product) return;

      if (confirmed && ceneoPrice) {
        // Price verified — notify users with confirmation
        const activeWatches = await db
          .select()
          .from(watches)
          .where(and(eq(watches.asin, asin), eq(watches.isActive, true)));

        for (const watch of activeWatches) {
          await notifyQueue.add(QUEUES.NOTIFY_USER, {
            telegramChatId: watch.telegramChatId,
            message: `Price verified at ${ceneoPrice} PLN via independent source.\n${product.title}`,
          } satisfies NotifyUserJob);
        }
      } else {
        // Not confirmed — notify admin only
        await notifyQueue.add(QUEUES.NOTIFY_USER, {
          telegramChatId: adminChatId,
          message: `Ceneo verification FAILED for ${asin}\n${product.title}\nCeneo price: ${ceneoPrice ?? 'not found'}\nAmazon not listed or price mismatch.`,
        } satisfies NotifyUserJob);
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`Ceneo-result job ${job?.id} failed:`, err.message);
  });

  return { worker, notifyQueue };
}
