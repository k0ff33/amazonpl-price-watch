import { describe, expect, it, vi } from 'vitest';
import { createPendingPriceHandler } from '../handlers/interactive.js';
import { setPendingTargetPrice } from '../interaction-state.js';
import { watches } from '@liskobot/shared';

function createCtx(text: string) {
  return {
    chat: { id: 123 },
    from: { id: 456 },
    message: { text },
    reply: vi.fn(async () => {}),
  } as any;
}

function createDbDouble(updated = true) {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => (updated ? [{ id: 'w1' }] : [])),
        })),
      })),
    })),
  } as any;
}

describe('pending target price handler', () => {
  it('sets target price for pending asin without requiring asin in message', async () => {
    const db = createDbDouble(true);
    const handler = createPendingPriceHandler(db);
    setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('199,99');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Target price for B0DEXAMPLE set to 199.99 PLN.');
    expect(db.update).toHaveBeenCalledWith(watches);
  });

  it('keeps pending flow active when invalid price is provided', async () => {
    const db = createDbDouble(true);
    const handler = createPendingPriceHandler(db);
    setPendingTargetPrice(123, 456, 'B0DEXAMPLE');
    const ctx = createCtx('abc');

    const consumed = await handler(ctx);

    expect(consumed).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith('Please send a valid price for B0DEXAMPLE, e.g. 199.99');
  });
});
