import { describe, it, expect } from 'vitest';
import { formatPriceAlert } from '../notifications.js';

describe('formatPriceAlert security behavior', () => {
  it('returns plain-text content and does not emit Markdown links', () => {
    const message = formatPriceAlert({
      title: '[evil](https://attacker.example)',
      asin: 'B0DEXAMPLE',
      oldPrice: '199.99',
      newPrice: '149.99',
      isHistoricalLow: false,
      unverified: false,
      associateTag: 'my-tag',
    });

    expect(message).toContain('Buy on Amazon.pl: https://www.amazon.pl/dp/B0DEXAMPLE?tag=my-tag');
    expect(message).not.toContain('[Buy on Amazon.pl](');
  });
});
