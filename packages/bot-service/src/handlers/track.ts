import { Context, InlineKeyboard } from 'grammy';
import { and, eq, sql } from 'drizzle-orm';
import { Db, products, watches } from '@liskobot/shared';
import { extractAsinFromMessage } from '../asin.js';

const MAX_ACTIVE_WATCHES_PER_USER = 50;

export function createTrackHandler(db: Db) {
  return async (ctx: Context) => {
    const commandArgs = (ctx.match as string | undefined)?.trim();
    const text = commandArgs && commandArgs.length > 0 ? commandArgs : ctx.message?.text;

    if (!text) return;

    const asin = await extractAsinFromMessage(text);
    if (!asin) {
      if (commandArgs !== undefined) {
        await ctx.reply('Usage: /track <Amazon.pl URL>');
      }
      return;
    }

    const chatId = ctx.chat?.id;
    const ownerUserId = ctx.from?.id;
    if (!chatId || !ownerUserId) return;

    await db
      .insert(products)
      .values({
        asin,
        title: `Product ${asin}`,
        nextCheckAt: new Date(),
      })
      .onConflictDoNothing({ target: products.asin });

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(watches)
      .where(and(
        eq(watches.ownerUserId, ownerUserId),
        eq(watches.isActive, true),
      ));
    const activeWatchCount = Number(countResult[0]?.count ?? 0);

    if (activeWatchCount >= MAX_ACTIVE_WATCHES_PER_USER) {
      await ctx.reply(
        `You've reached the maximum of ${MAX_ACTIVE_WATCHES_PER_USER} active watches. ` +
          'Use /stop <ASIN> to remove one before adding another.',
      );
      return;
    }

    const insertedWatch = await db
      .insert(watches)
      .values({
        telegramChatId: chatId,
        ownerUserId,
        asin,
      })
      .onConflictDoNothing({
        target: [watches.telegramChatId, watches.ownerUserId, watches.asin],
      })
      .returning({ id: watches.id });

    if (insertedWatch.length === 0) {
      await ctx.reply(`You're already tracking this product (${asin}).`);
      return;
    }

    await db
      .update(products)
      .set({ subscriberCount: sql`COALESCE(${products.subscriberCount}, 0) + 1` })
      .where(eq(products.asin, asin));

    const keyboard = new InlineKeyboard()
      .text('Set target price', `set_target:${asin}`)
      .row()
      .text('Pause', `pause:${asin}`)
      .text('Stop', `stop:${asin}`)
      .row()
      .url('Open on Amazon', `https://www.amazon.pl/dp/${asin}`);

    await ctx.reply(
      `Tracking ${asin}! I'll notify you when the price drops.\n` +
        'Tap “Set target price” to set your target without pasting the ASIN.',
      { reply_markup: keyboard },
    );
  };
}
