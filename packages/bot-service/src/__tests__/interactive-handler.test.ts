import { describe, expect, it, vi } from 'vitest';
import { createCallbackQueryHandler, createNaturalInputHandler, createPendingPriceHandler } from '../handlers/interactive.js';
import type { InteractionState } from '../interaction-state.js';
import { products, watches } from '@liskobot/shared';

function createInMemoryState(): InteractionState {
  const pending = new Map<string, string>();
  const lastTracked = new Map<string, string>();
  const k = (chatId: number, userId: number) => `${chatId}:${userId}`;
  return {
    async setPendingTargetPrice(chatId, userId, asin) {
      pending.set(k(chatId, userId), asin);
      lastTracked.set(k(chatId, userId), asin);
    },
    async getPendingTargetPrice(chatId, userId) {
      return pending.get(k(chatId, userId)) ?? null;
    },
    async clearPendingAction(chatId, userId) {
      pending.delete(k(chatId, userId));
    },
    async setLastTrackedAsin(chatId, userId, asin) {
      lastTracked.set(k(chatId, userId), asin);
    },
    async getLastTrackedAsin(chatId, userId) {
      return lastTracked.get(k(chatId, userId)) ?? null;
    },
  };
}

function createCtx(text: string) {
  return {
    chat: { id: 123 },
    from: { id: 456 },
    message: { text },
    reply: vi.fn(async () => {}),
  } as any;
}

function createCallbackCtx(data: string) {
  return {
    chat: { id: 123 },
    from: { id: 456 },
    callbackQuery: { data },
    answerCallbackQuery: vi.fn(async () => {}),
    reply: vi.fn(async () => {}),
  } as any;
}

function createDbDouble(input: { updated?: boolean; deleted?: boolean } = {}) {
  const updated = input.updated ?? true;
  const deleted = input.deleted ?? true;

  return {
    update: vi.fn((_table: unknown) => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => (updated ? [{ id: 'w1' }] : [])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => (deleted ? [{ asin: 'B0DEXAMPLE' }] : [])),
      })),
    })),
  } as any;
}

describe('pending target price handler', () => {
  it('sets target price for pending asin without requiring asin in message', async () => {
    const db = createDbDouble({ updated: true });
    const state = createInMemoryState();
    const handler = createPendingPriceHandler(db, state);
    await state.setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('199,99');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Target price for B0DEXAMPLE set to 199.99 PLN.');
    expect(db.update).toHaveBeenCalledWith(watches);
  });

  it('does not consume amazon url while pending, so tracking can continue', async () => {
    const db = createDbDouble({ updated: true });
    const state = createInMemoryState();
    const handler = createPendingPriceHandler(db, state);
    await state.setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('https://www.amazon.pl/dp/B0DANOTHER');

    const consumed = await handler(ctx);

    expect(consumed).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('keeps pending flow active when invalid price is provided', async () => {
    const db = createDbDouble({ updated: true });
    const state = createInMemoryState();
    const handler = createPendingPriceHandler(db, state);
    await state.setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('abc');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Please send a valid price for B0DEXAMPLE, e.g. 199.99');
  });
});

describe('natural input handler', () => {
  it('handles set 199 shortcut for last tracked asin', async () => {
    const db = createDbDouble({ updated: true });
    const state = createInMemoryState();
    const handler = createNaturalInputHandler(db, state);
    await state.setLastTrackedAsin(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('set 199');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Target price for B0DEXAMPLE set to 199.00 PLN.');
    expect(db.update).toHaveBeenCalledWith(watches);
  });

  it('handles stop shortcut for last tracked asin', async () => {
    const db = createDbDouble({ updated: true, deleted: true });
    const state = createInMemoryState();
    const handler = createNaturalInputHandler(db, state);
    await state.setLastTrackedAsin(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('stop');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Stopped tracking B0DEXAMPLE.');
    expect(db.delete).toHaveBeenCalledWith(watches);
    expect(db.update).toHaveBeenCalledWith(products);
  });

  it('clears pending state after successful pause', async () => {
    const db = createDbDouble({ updated: true });
    const state = createInMemoryState();
    const handler = createNaturalInputHandler(db, state);
    await state.setLastTrackedAsin(123, 456, 'B0DEXAMPLE');
    await state.setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('pause');

    await handler(ctx);

    expect(await state.getPendingTargetPrice(123, 456)).toBeNull();
  });

  it('clears pending state after successful stop', async () => {
    const db = createDbDouble({ deleted: true });
    const state = createInMemoryState();
    const handler = createNaturalInputHandler(db, state);
    await state.setLastTrackedAsin(123, 456, 'B0DEXAMPLE');
    await state.setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('stop');

    await handler(ctx);

    expect(await state.getPendingTargetPrice(123, 456)).toBeNull();
  });
});

describe('callback query handler', () => {
  it('set_target stores pending price and replies with prompt', async () => {
    const db = createDbDouble();
    const state = createInMemoryState();
    const handler = createCallbackQueryHandler(db, state);
    const ctx = createCallbackCtx('set_target:B0DEXAMPLE');

    await handler(ctx);

    expect(await state.getPendingTargetPrice(123, 456)).toBe('B0DEXAMPLE');
    expect(ctx.reply).toHaveBeenCalledWith('Send target price for B0DEXAMPLE (e.g. 199.99).');
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Send target price now' });
  });

  it('pause action clears pending state', async () => {
    const db = createDbDouble({ updated: true });
    const state = createInMemoryState();
    const handler = createCallbackQueryHandler(db, state);
    await state.setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCallbackCtx('pause:B0DEXAMPLE');

    await handler(ctx);

    expect(await state.getPendingTargetPrice(123, 456)).toBeNull();
    expect(ctx.reply).toHaveBeenCalledWith('Paused tracking for B0DEXAMPLE.');
  });

  it('stop action clears pending state', async () => {
    const db = createDbDouble({ deleted: true });
    const state = createInMemoryState();
    const handler = createCallbackQueryHandler(db, state);
    await state.setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCallbackCtx('stop:B0DEXAMPLE');

    await handler(ctx);

    expect(await state.getPendingTargetPrice(123, 456)).toBeNull();
    expect(ctx.reply).toHaveBeenCalledWith('Stopped tracking B0DEXAMPLE.');
  });

  it('invalid payload answers with error', async () => {
    const db = createDbDouble();
    const state = createInMemoryState();
    const handler = createCallbackQueryHandler(db, state);
    const ctx = createCallbackCtx('invalid_no_colon');

    await handler(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Invalid action.' });
  });

  it('unknown action answers with unsupported message', async () => {
    const db = createDbDouble();
    const state = createInMemoryState();
    const handler = createCallbackQueryHandler(db, state);
    const ctx = createCallbackCtx('unknown:B0DEXAMPLE');

    await handler(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: 'Unsupported action.' });
  });
});
