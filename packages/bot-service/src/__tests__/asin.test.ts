import { describe, it, expect, vi } from 'vitest';
import { extractAsin, extractAsinFromMessage, resolveAmznEuShortLink } from '../asin.js';

describe('extractAsin', () => {
  it('extracts ASIN from standard product URL', () => {
    expect(extractAsin('https://www.amazon.pl/dp/B0DEXAMPLE')).toBe('B0DEXAMPLE');
  });

  it('extracts ASIN from URL with title slug', () => {
    expect(extractAsin('https://www.amazon.pl/Some-Product-Name/dp/B0DEXAMPLE/ref=sr_1_1')).toBe('B0DEXAMPLE');
  });

  it('extracts ASIN from shortened URL', () => {
    expect(extractAsin('https://amazon.pl/dp/B0DEXAMPLE?tag=foo')).toBe('B0DEXAMPLE');
  });

  it('returns null for non-Amazon URLs', () => {
    expect(extractAsin('https://google.com')).toBeNull();
  });

  it('returns null for Amazon URLs without ASIN', () => {
    expect(extractAsin('https://www.amazon.pl/bestsellers')).toBeNull();
  });

  it('extracts ASIN from amzn.eu short link via resolver', async () => {
    const resolveShortLink = vi
      .fn<(url: string) => Promise<string | null>>()
      .mockResolvedValue('https://www.amazon.pl/dp/B0DEXAMPLE?ref_=abc');

    await expect(extractAsinFromMessage('https://amzn.eu/d/0cGtXgio', resolveShortLink)).resolves.toBe('B0DEXAMPLE');
    expect(resolveShortLink).toHaveBeenCalledWith('https://amzn.eu/d/0cGtXgio');
  });

  it('returns null when amzn.eu short link cannot be resolved', async () => {
    const resolveShortLink = vi.fn<(url: string) => Promise<string | null>>().mockResolvedValue(null);

    await expect(extractAsinFromMessage('https://amzn.eu/d/0cGtXgio', resolveShortLink)).resolves.toBeNull();
  });
});

describe('resolveAmznEuShortLink', () => {
  it('uses manual redirect mode and returns Location header target', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => ({
      status: 301,
      url: 'https://amzn.eu/d/0cGtXgio',
      headers: {
        get: (name: string) => (name.toLowerCase() === 'location' ? 'https://www.amazon.pl/dp/B0DEXAMPLE?ref_=abc' : null),
      },
    })) as any;
    globalThis.fetch = fetchMock;

    try {
      await expect(resolveAmznEuShortLink('https://amzn.eu/d/0cGtXgio')).resolves.toBe(
        'https://www.amazon.pl/dp/B0DEXAMPLE?ref_=abc',
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://amzn.eu/d/0cGtXgio',
        expect.objectContaining({ redirect: 'manual' }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns null when redirect response has no Location header', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      status: 302,
      url: 'https://amzn.eu/d/0cGtXgio',
      headers: { get: () => null },
    })) as any;

    try {
      await expect(resolveAmznEuShortLink('https://amzn.eu/d/0cGtXgio')).resolves.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
