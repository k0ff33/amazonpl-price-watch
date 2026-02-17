import { describe, it, expect, vi } from 'vitest';
import type { ScrapeResult } from '../crawler.js';
import { scrapeWithFallback } from '../scrape-with-fallback.js';

interface FakeCrawler {
  run: (requests: Array<{ url: string; userData: { asin: string } }>) => Promise<void>;
}

describe('scrapeWithFallback', () => {
  it('returns direct result without invoking proxy when direct scrape is not blocked', async () => {
    const asin = 'B000000001';
    const directResults = new Map<string, ScrapeResult>();
    const proxyResults = new Map<string, ScrapeResult>();

    const directRun = vi.fn(async () => {
      directResults.set(asin, { price: '99.99', isInStock: true, title: 'Direct title' });
    });
    const proxyRun = vi.fn(async () => {
      proxyResults.set(asin, { price: '89.99', isInStock: true, title: 'Proxy title' });
    });

    const output = await scrapeWithFallback({
      asin,
      url: `https://www.amazon.pl/dp/${asin}`,
      direct: { crawler: { run: directRun } as FakeCrawler, results: directResults },
      proxy: { crawler: { run: proxyRun } as FakeCrawler, results: proxyResults },
    });

    expect(output.result.price).toBe('99.99');
    expect(output.usedProxyFallback).toBe(false);
    expect(directRun).toHaveBeenCalledTimes(1);
    expect(proxyRun).not.toHaveBeenCalled();
    expect(directResults.has(asin)).toBe(false);
  });

  it('retries with proxy when direct scrape is blocked', async () => {
    const asin = 'B000000002';
    const directResults = new Map<string, ScrapeResult>();
    const proxyResults = new Map<string, ScrapeResult>();

    const directRun = vi.fn(async () => {
      directResults.set(asin, { price: null, isInStock: false, title: null, blocked: true });
    });
    const proxyRun = vi.fn(async () => {
      proxyResults.set(asin, { price: '120.00', isInStock: true, title: 'Proxy title' });
    });

    const output = await scrapeWithFallback({
      asin,
      url: `https://www.amazon.pl/dp/${asin}`,
      direct: { crawler: { run: directRun } as FakeCrawler, results: directResults },
      proxy: { crawler: { run: proxyRun } as FakeCrawler, results: proxyResults },
    });

    expect(output.result.price).toBe('120.00');
    expect(output.usedProxyFallback).toBe(true);
    expect(output.directBlocked).toBe(true);
    expect(directRun).toHaveBeenCalledTimes(1);
    expect(proxyRun).toHaveBeenCalledTimes(1);
    expect(proxyResults.has(asin)).toBe(false);
  });

  it('returns blocked result when proxy fallback is not configured', async () => {
    const asin = 'B000000003';
    const directResults = new Map<string, ScrapeResult>();

    const directRun = vi.fn(async () => {
      directResults.set(asin, { price: null, isInStock: false, title: null, blocked: true });
    });

    const output = await scrapeWithFallback({
      asin,
      url: `https://www.amazon.pl/dp/${asin}`,
      direct: { crawler: { run: directRun } as FakeCrawler, results: directResults },
    });

    expect(output.result.blocked).toBe(true);
    expect(output.usedProxyFallback).toBe(false);
    expect(output.directBlocked).toBe(true);
    expect(directRun).toHaveBeenCalledTimes(1);
  });
});
