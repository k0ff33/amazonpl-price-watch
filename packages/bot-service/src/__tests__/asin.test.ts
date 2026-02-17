import { describe, it, expect } from 'vitest';
import { extractAsin } from '../asin.js';

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
});
