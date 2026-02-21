import { describe, expect, it, vi } from 'vitest';
import { createNaturalInputHandler, createPendingPriceHandler } from '../handlers/interactive.js';
import { setLastTrackedAsin, setPendingTargetPrice } from '../interaction-state.js';
import { products, watches } from '@liskobot/shared';

function createCtx(text: string) {
  return {
    chat: { id: 123 },
    from: { id: 456 },
    message: { text },
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
    const handler = createPendingPriceHandler(db);
    setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('199,99');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Target price for B0DEXAMPLE set to 199.99 PLN.');
    expect(db.update).toHaveBeenCalledWith(watches);
  });

  it('does not consume amazon url while pending, so tracking can continue', async () => {
    const db = createDbDouble({ updated: true });
    const handler = createPendingPriceHandler(db);
    setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('https://www.amazon.pl/dp/B0DANOTHER');

    const consumed = await handler(ctx);

    expect(consumed).toBe(false);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('keeps pending flow active when invalid price is provided', async () => {
    const db = createDbDouble({ updated: true });
    const handler = createPendingPriceHandler(db);
    setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('abc');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Please send a valid price for B0DEXAMPLE, e.g. 199.99');
  });
});

describe('natural input handler', () => {
  it('handles set 199 shortcut for last tracked asin', async () => {
    const db = createDbDouble({ updated: true });
    const handler = createNaturalInputHandler(db);
    setLastTrackedAsin(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('set 199');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Target price for B0DEXAMPLE set to 199.00 PLN.');
    expect(db.update).toHaveBeenCalledWith(watches);
  });

  it('handles stop shortcut for last tracked asin', async () => {
    const db = createDbDouble({ updated: true, deleted: true });
    const handler = createNaturalInputHandler(db);
    setLastTrackedAsin(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('stop');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Stopped tracking B0DEXAMPLE.');
    expect(db.delete).toHaveBeenCalledWith(watches);
    expect(db.update).toHaveBeenCalledWith(products);
  });
});
