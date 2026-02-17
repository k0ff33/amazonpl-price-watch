import { describe, it, expect, vi } from 'vitest';
import { createPauseHandler } from '../handlers/pause.js';

function createDbDouble() {
  const whereSpy = vi.fn(async () => []);

  const db = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: whereSpy,
      })),
    })),
  } as any;

  return { db, whereSpy };
}

describe('createPauseHandler ownership behavior', () => {
  it('requires sender identity and does not update without ctx.from', async () => {
    const { db, whereSpy } = createDbDouble();

    const ctx = {
      chat: { id: 12345 },
      match: 'B0DEXAMPLE',
      // from intentionally missing
      reply: vi.fn(async () => undefined),
    } as any;

    const handler = createPauseHandler(db);

    await handler(ctx);

    expect(whereSpy).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Usage: /pause <ASIN>');
  });
});
