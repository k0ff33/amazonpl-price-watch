import { describe, expect, it } from 'vitest';
import { calculateNextCheckAtAfterScrape } from '../next-check.js';

describe('calculateNextCheckAtAfterScrape', () => {
  it('uses scraped price when available', () => {
    const now = new Date('2026-02-21T12:00:00.000Z');

    const nextCheckAt = calculateNextCheckAtAfterScrape({
      scrapedPrice: '25.00',
      currentPrice: null,
      subscriberCount: 50,
      volatilityScore: '0.5',
      now,
    });

    expect(nextCheckAt.toISOString()).toBe('2026-02-22T12:00:00.000Z');
  });

  it('falls back to current price when scrape has no price', () => {
    const now = new Date('2026-02-21T12:00:00.000Z');

    const nextCheckAt = calculateNextCheckAtAfterScrape({
      scrapedPrice: null,
      currentPrice: '200.00',
      subscriberCount: 5,
      volatilityScore: '0.3',
      now,
    });

    expect(nextCheckAt.toISOString()).toBe('2026-02-21T16:00:00.000Z');
  });

  it('uses default 4h interval when neither scraped nor current price exists', () => {
    const now = new Date('2026-02-21T12:00:00.000Z');

    const nextCheckAt = calculateNextCheckAtAfterScrape({
      scrapedPrice: null,
      currentPrice: null,
      subscriberCount: 0,
      volatilityScore: null,
      now,
    });

    expect(nextCheckAt.toISOString()).toBe('2026-02-21T16:00:00.000Z');
  });
});
