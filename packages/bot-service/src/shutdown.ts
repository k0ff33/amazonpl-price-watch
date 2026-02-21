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
    await Promise.all(workers.map((w) => w.close()));
  };
}
