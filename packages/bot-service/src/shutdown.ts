import type { Bot } from 'grammy';
import type { Worker } from 'bullmq';

export function createShutdownHandler(
  bot: Pick<Bot, 'stop'>,
  workers: Pick<Worker, 'close'>[],
): () => Promise<void> {
  return async () => {
    try {
      await bot.stop();
    } catch (err) {
      console.error('Error stopping bot:', err);
    }
    const results = await Promise.allSettled(workers.map((w) => w.close()));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error closing worker at index ${index}:`, result.reason);
      }
    });
  };
}
