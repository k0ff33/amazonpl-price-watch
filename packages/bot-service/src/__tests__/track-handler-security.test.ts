import { describe, it, expect, vi } from 'vitest';
import { createTrackHandler } from '../handlers/track.js';
import type { InteractionState } from '../interaction-state.js';
import { products, watches } from '@liskobot/shared';

const noopState: InteractionState = {
  async setPendingTargetPrice() {},
  async getPendingTargetPrice() { return null; },
  async clearPendingAction() {},
  async setLastTrackedAsin() {},
  async getLastTrackedAsin() { return null; },
};

function createContext(overrides: Partial<any> = {}) {
  const replies: string[] = [];
  return {
    message: { text: 'https://www.amazon.pl/dp/B0DEXAMPLE' },
    chat: { id: 12345 },
    from: { id: 777001 },
    reply: vi.fn(async (msg: string) => {
      replies.push(msg);
    }),
    ...overrides,
    __replies: replies,
  } as any;
}

function createDbDouble(input: {
  activeWatchCount: number;
  watchInsertResult?: Array<{ id: string }>;
}) {
  const insertedWatchValues: any[] = [];

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ count: input.activeWatchCount }]),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((value: any) => {
        if (table === watches) {
          insertedWatchValues.push(value);
        }

        return {
          onConflictDoNothing: vi.fn(() =>
            table === watches
              ? {
                  returning: vi.fn(
                    async () => input.watchInsertResult ?? [{ id: 'watch-1' }],
                  ),
                }
              : [],
          ),
        };
      }),
    })),
    update: vi.fn((_table: unknown) => ({
      set: vi.fn((_values: any) => ({
        where: vi.fn(async () => []),
      })),
    })),
  } as any;

  return { db, insertedWatchValues };
}

describe('createTrackHandler security behavior', () => {
  it('stores ownerUserId on newly created watches', async () => {
    const { db, insertedWatchValues } = createDbDouble({
      activeWatchCount: 0,
    });

    const ctx = createContext();
    const handler = createTrackHandler(db, noopState);

    await handler(ctx);

    expect(insertedWatchValues).toHaveLength(1);
    expect(insertedWatchValues[0]).toMatchObject({
      telegramChatId: 12345,
      ownerUserId: 777001,
      asin: 'B0DEXAMPLE',
    });
  });

  it('enforces per-user active watch quota', async () => {
    const { db, insertedWatchValues } = createDbDouble({
      activeWatchCount: 50,
    });

    const ctx = createContext();
    const handler = createTrackHandler(db, noopState);

    await handler(ctx);

    expect(insertedWatchValues).toHaveLength(0);
    expect(ctx.reply).toHaveBeenCalled();
    expect(ctx.__replies.join('\n')).toMatch(/limit|quota|max/i);
  });

  it('resolves amzn.eu short links before storing watch', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      status: 301,
      url: 'https://amzn.eu/d/0cGtXgio',
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'location'
            ? 'https://www.amazon.pl/dp/B0DEXAMPLE'
            : null,
      },
    })) as any;

    try {
      const { db, insertedWatchValues } = createDbDouble({
        activeWatchCount: 0,
      });

      const ctx = createContext({
        message: { text: 'https://amzn.eu/d/0cGtXgio' },
      });
      const handler = createTrackHandler(db, noopState);

      await handler(ctx);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://amzn.eu/d/0cGtXgio',
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(insertedWatchValues).toHaveLength(1);
      expect(insertedWatchValues[0]).toMatchObject({
        asin: 'B0DEXAMPLE',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
