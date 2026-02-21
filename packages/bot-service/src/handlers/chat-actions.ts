import { and, eq, sql } from 'drizzle-orm';
import { Db, products, watches } from '@liskobot/shared';

export async function setTargetPriceForWatch(
  db: Db,
  chatId: number,
  ownerUserId: number,
  asin: string,
  price: number,
) {
  const result = await db
    .update(watches)
    .set({ targetPrice: price.toFixed(2) })
    .where(
      and(
        eq(watches.telegramChatId, chatId),
        eq(watches.ownerUserId, ownerUserId),
        eq(watches.asin, asin.toUpperCase()),
      ),
    )
    .returning({ id: watches.id });

  return result.length > 0;
}

export async function pauseWatch(db: Db, chatId: number, ownerUserId: number, asin: string) {
  const result = await db
    .update(watches)
    .set({ isActive: false })
    .where(
      and(
        eq(watches.telegramChatId, chatId),
        eq(watches.ownerUserId, ownerUserId),
        eq(watches.asin, asin.toUpperCase()),
      ),
    )
    .returning({ id: watches.id });

  return result.length > 0;
}

export async function stopWatch(db: Db, chatId: number, ownerUserId: number, asin: string) {
  const upperAsin = asin.toUpperCase();

  const deleted = await db
    .delete(watches)
    .where(
      and(
        eq(watches.telegramChatId, chatId),
        eq(watches.ownerUserId, ownerUserId),
        eq(watches.asin, upperAsin),
      ),
    )
    .returning({ asin: watches.asin });

  if (deleted.length === 0) {
    return false;
  }

  await db
    .update(products)
    .set({ subscriberCount: sql`GREATEST(COALESCE(${products.subscriberCount}, 0) - 1, 0)` })
    .where(eq(products.asin, upperAsin));

  return true;
}
