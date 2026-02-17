import { describe, it, expect } from 'vitest';
import { buildCeneoSearchUrl, parseCeneoIdFromUrl } from '../search.js';

describe('buildCeneoSearchUrl', () => {
  it('builds search URL from product title', () => {
    const url = buildCeneoSearchUrl('Sony WH-1000XM5 Headphones');
    expect(url).toBe('https://www.ceneo.pl/szukaj-Sony+WH-1000XM5+Headphones');
  });
});

describe('parseCeneoIdFromUrl', () => {
  it('extracts Ceneo product ID from product URL', () => {
    expect(parseCeneoIdFromUrl('https://www.ceneo.pl/180784185')).toBe('180784185');
  });

  it('returns null for non-product URLs', () => {
    expect(parseCeneoIdFromUrl('https://www.ceneo.pl/szukaj-test')).toBeNull();
  });
});
