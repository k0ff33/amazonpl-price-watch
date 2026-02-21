import { describe, expect, it } from 'vitest';
import { isSoftBlockedSignals, type SoftBlockSignals } from '../amazon-page-signals.js';

function makeSignals(overrides: Partial<SoftBlockSignals> = {}): SoftBlockSignals {
  return {
    titleText: 'Amazon.pl: Product',
    bodyText: 'Normal product page content',
    hasProductTitle: true,
    hasPrimaryPrice: true,
    hasAddToCart: true,
    hasBuyNow: true,
    ...overrides,
  };
}

describe('isSoftBlockedSignals', () => {
  it('detects robot-check title as a soft block', () => {
    const result = isSoftBlockedSignals(
      makeSignals({
        titleText: 'Robot Check',
        hasProductTitle: false,
        hasPrimaryPrice: false,
        hasAddToCart: false,
        hasBuyNow: false,
      }),
    );

    expect(result).toBe(true);
  });

  it('detects automated-access warning text as a soft block', () => {
    const result = isSoftBlockedSignals(
      makeSignals({
        bodyText:
          'To discuss automated access to Amazon data please contact api-services-support@amazon.com.',
        hasProductTitle: false,
        hasPrimaryPrice: false,
        hasAddToCart: false,
        hasBuyNow: false,
      }),
    );

    expect(result).toBe(true);
  });

  it('does not flag valid in-stock product signals', () => {
    const result = isSoftBlockedSignals(
      makeSignals({
        titleText: 'UbiQuiti USW-PRO-8-POE',
      }),
    );

    expect(result).toBe(false);
  });

  it('does not flag valid out-of-stock signals', () => {
    const result = isSoftBlockedSignals(
      makeSignals({
        titleText: 'UbiQuiti USW-PRO-MAX-16-POE',
        hasPrimaryPrice: false,
        hasAddToCart: false,
        hasBuyNow: false,
      }),
    );

    expect(result).toBe(false);
  });
});
