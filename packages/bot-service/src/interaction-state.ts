import type { Redis } from 'ioredis';

const STATE_TTL_SECONDS = 30 * 60;

function key(chatId: number, ownerUserId: number) {
  return `interaction:${chatId}:${ownerUserId}`;
}

export type InteractionState = {
  setPendingTargetPrice(chatId: number, ownerUserId: number, asin: string): Promise<void>;
  getPendingTargetPrice(chatId: number, ownerUserId: number): Promise<string | null>;
  clearPendingAction(chatId: number, ownerUserId: number): Promise<void>;
  setLastTrackedAsin(chatId: number, ownerUserId: number, asin: string): Promise<void>;
  getLastTrackedAsin(chatId: number, ownerUserId: number): Promise<string | null>;
};

export function createInteractionState(redis: Redis): InteractionState {
  return {
    async setPendingTargetPrice(chatId, ownerUserId, asin) {
      const k = key(chatId, ownerUserId);
      await redis.hset(k, 'pendingTargetAsin', asin, 'lastTrackedAsin', asin);
      await redis.expire(k, STATE_TTL_SECONDS);
    },

    async getPendingTargetPrice(chatId, ownerUserId) {
      const k = key(chatId, ownerUserId);
      const asin = await redis.hget(k, 'pendingTargetAsin');
      if (asin) await redis.expire(k, STATE_TTL_SECONDS);
      return asin ?? null;
    },

    async clearPendingAction(chatId, ownerUserId) {
      const k = key(chatId, ownerUserId);
      await redis.hdel(k, 'pendingTargetAsin');
      await redis.expire(k, STATE_TTL_SECONDS);
    },

    async setLastTrackedAsin(chatId, ownerUserId, asin) {
      const k = key(chatId, ownerUserId);
      await redis.hset(k, 'lastTrackedAsin', asin);
      await redis.expire(k, STATE_TTL_SECONDS);
    },

    async getLastTrackedAsin(chatId, ownerUserId) {
      const k = key(chatId, ownerUserId);
      const asin = await redis.hget(k, 'lastTrackedAsin');
      if (asin) await redis.expire(k, STATE_TTL_SECONDS);
      return asin ?? null;
    },
  };
}
