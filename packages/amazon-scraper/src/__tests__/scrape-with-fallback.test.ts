import { describe, it, expect, vi } from 'vitest';
import type { ScrapeResult } from '../crawler.js';
import { scrapeWithFallback } from '../scrape-with-fallback.js';

describe('scrapeWithFallback', () => {
  it('returns Impit-direct result when the first scrape is not blocked', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '99.99',
      isInStock: true,
      title: 'Direct title',
    }));
    const impitProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '89.99',
      isInStock: true,
      title: 'Proxy title',
    }));
    const playwrightProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '79.99',
      isInStock: true,
      title: 'Playwright title',
    }));

    const output = await scrapeWithFallback({
      impitDirect,
      impitProxy,
      playwrightProxy,
    });

    expect(output.result.price).toBe('99.99');
    expect(output.strategy).toBe('impit_direct');
    expect(output.directBlocked).toBe(false);
    expect(output.usedProxyFallback).toBe(false);
    expect(output.usedPlaywrightFallback).toBe(false);
    expect(impitDirect).toHaveBeenCalledTimes(1);
    expect(impitProxy).not.toHaveBeenCalled();
    expect(playwrightProxy).not.toHaveBeenCalled();
  });

  it('uses Impit-proxy fallback when direct Impit is blocked', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: null,
      blocked: true,
    }));
    const impitProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '120.00',
      isInStock: true,
      title: 'Proxy title',
    }));
    const playwrightProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '110.00',
      isInStock: true,
      title: 'Playwright title',
    }));

    const output = await scrapeWithFallback({
      impitDirect,
      impitProxy,
      playwrightProxy,
    });

    expect(output.result.price).toBe('120.00');
    expect(output.strategy).toBe('impit_proxy');
    expect(output.usedProxyFallback).toBe(true);
    expect(output.usedPlaywrightFallback).toBe(false);
    expect(output.directBlocked).toBe(true);
    expect(impitDirect).toHaveBeenCalledTimes(1);
    expect(impitProxy).toHaveBeenCalledTimes(1);
    expect(playwrightProxy).not.toHaveBeenCalled();
  });

  it('uses Playwright-proxy fallback when both Impit attempts are blocked', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: null,
      blocked: true,
    }));
    const impitProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: null,
      blocked: true,
    }));
    const playwrightProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '130.00',
      isInStock: true,
      title: 'Playwright title',
    }));

    const output = await scrapeWithFallback({
      impitDirect,
      impitProxy,
      playwrightProxy,
    });

    expect(output.result.price).toBe('130.00');
    expect(output.strategy).toBe('playwright_proxy');
    expect(output.usedProxyFallback).toBe(true);
    expect(output.usedPlaywrightFallback).toBe(true);
    expect(output.directBlocked).toBe(true);
    expect(impitDirect).toHaveBeenCalledTimes(1);
    expect(impitProxy).toHaveBeenCalledTimes(1);
    expect(playwrightProxy).toHaveBeenCalledTimes(1);
  });

  it('returns the blocked direct result when no fallback is configured', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: null,
      blocked: true,
    }));

    const output = await scrapeWithFallback({
      impitDirect,
    });

    expect(output.result.blocked).toBe(true);
    expect(output.strategy).toBe('impit_direct');
    expect(output.usedProxyFallback).toBe(false);
    expect(output.usedPlaywrightFallback).toBe(false);
    expect(output.directBlocked).toBe(true);
    expect(impitDirect).toHaveBeenCalledTimes(1);
  });

  it('returns Impit-proxy blocked result when Playwright fallback is not configured', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: null,
      blocked: true,
    }));
    const impitProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: null,
      blocked: true,
    }));

    const output = await scrapeWithFallback({
      impitDirect,
      impitProxy,
    });

    expect(output.result.blocked).toBe(true);
    expect(output.strategy).toBe('impit_proxy');
    expect(output.usedProxyFallback).toBe(true);
    expect(output.usedPlaywrightFallback).toBe(false);
    expect(output.directBlocked).toBe(true);
    expect(impitDirect).toHaveBeenCalledTimes(1);
    expect(impitProxy).toHaveBeenCalledTimes(1);
  });

  it('escalates to Impit-proxy when direct succeeds but returns no price', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: true,
      title: 'Some Product',
    }));
    const impitProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '499.00',
      isInStock: true,
      title: 'Some Product',
    }));
    const playwrightProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '399.00',
      isInStock: true,
      title: 'Some Product',
    }));

    const output = await scrapeWithFallback({ impitDirect, impitProxy, playwrightProxy });

    expect(output.result.price).toBe('499.00');
    expect(output.strategy).toBe('impit_proxy');
    expect(output.directBlocked).toBe(false);
    expect(output.usedProxyFallback).toBe(true);
    expect(output.usedPlaywrightFallback).toBe(false);
    expect(impitDirect).toHaveBeenCalledTimes(1);
    expect(impitProxy).toHaveBeenCalledTimes(1);
    expect(playwrightProxy).not.toHaveBeenCalled();
  });

  it('escalates to Playwright when direct and proxy both succeed but return no price', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: true,
      title: 'Some Product',
    }));
    const impitProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: true,
      title: 'Some Product',
    }));
    const playwrightProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: '599.00',
      isInStock: true,
      title: 'Some Product',
    }));

    const output = await scrapeWithFallback({ impitDirect, impitProxy, playwrightProxy });

    expect(output.result.price).toBe('599.00');
    expect(output.strategy).toBe('playwright_proxy');
    expect(output.directBlocked).toBe(false);
    expect(output.usedProxyFallback).toBe(true);
    expect(output.usedPlaywrightFallback).toBe(true);
    expect(impitDirect).toHaveBeenCalledTimes(1);
    expect(impitProxy).toHaveBeenCalledTimes(1);
    expect(playwrightProxy).toHaveBeenCalledTimes(1);
  });

  it('returns direct no-price result when no proxy is configured', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: 'Some Product',
    }));

    const output = await scrapeWithFallback({ impitDirect });

    expect(output.result.price).toBeNull();
    expect(output.strategy).toBe('impit_direct');
    expect(output.directBlocked).toBe(false);
    expect(output.usedProxyFallback).toBe(false);
    expect(output.usedPlaywrightFallback).toBe(false);
    expect(impitDirect).toHaveBeenCalledTimes(1);
  });

  it('returns proxy no-price result when proxy succeeds but price is missing and Playwright is not configured', async () => {
    const impitDirect = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: 'Some Product',
    }));
    const impitProxy = vi.fn(async (): Promise<ScrapeResult> => ({
      price: null,
      isInStock: false,
      title: 'Some Product',
    }));

    const output = await scrapeWithFallback({ impitDirect, impitProxy });

    expect(output.result.price).toBeNull();
    expect(output.strategy).toBe('impit_proxy');
    expect(output.directBlocked).toBe(false);
    expect(output.usedProxyFallback).toBe(true);
    expect(output.usedPlaywrightFallback).toBe(false);
    expect(impitDirect).toHaveBeenCalledTimes(1);
    expect(impitProxy).toHaveBeenCalledTimes(1);
  });
});
