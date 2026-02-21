import { describe, it, expect, vi } from 'vitest';
import { createShutdownHandler } from '../shutdown.js';

describe('createShutdownHandler', () => {
  it('calls bot.stop() when shutdown is triggered', async () => {
    const mockBot = { stop: vi.fn().mockResolvedValue(undefined) };
    const handler = createShutdownHandler(mockBot as any, []);

    await handler();

    expect(mockBot.stop).toHaveBeenCalledOnce();
  });

  it('closes all workers when shutdown is triggered', async () => {
    const mockBot = { stop: vi.fn().mockResolvedValue(undefined) };
    const mockWorker1 = { close: vi.fn().mockResolvedValue(undefined) };
    const mockWorker2 = { close: vi.fn().mockResolvedValue(undefined) };
    const handler = createShutdownHandler(mockBot as any, [
      mockWorker1 as any,
      mockWorker2 as any,
    ]);

    await handler();

    expect(mockWorker1.close).toHaveBeenCalledOnce();
    expect(mockWorker2.close).toHaveBeenCalledOnce();
  });

  it('still closes workers if bot.stop() throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockBot = { stop: vi.fn().mockRejectedValue(new Error('stop failed')) };
    const mockWorker = { close: vi.fn().mockResolvedValue(undefined) };
    const handler = createShutdownHandler(mockBot as any, [mockWorker as any]);

    try {
      await handler();

      expect(mockWorker.close).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('continues closing workers if one close() rejects', async () => {
    const mockBot = { stop: vi.fn().mockResolvedValue(undefined) };
    const mockWorker1 = { close: vi.fn().mockRejectedValue(new Error('close failed')) };
    const mockWorker2 = { close: vi.fn().mockResolvedValue(undefined) };
    const handler = createShutdownHandler(mockBot as any, [
      mockWorker1 as any,
      mockWorker2 as any,
    ]);

    await handler();

    expect(mockWorker1.close).toHaveBeenCalledOnce();
    expect(mockWorker2.close).toHaveBeenCalledOnce();
  });
});
