import { describe, it, expect } from 'vitest';
import { analyzePriceChange } from '../price-processor.js';

describe('analyzePriceChange', () => {
  it('detects normal price drop', () => {
    const result = analyzePriceChange('199.00', '149.00', '140.00');
    expect(result.type).toBe('normal_drop');
    expect(result.dropPercent).toBeCloseTo(25.13, 1);
    expect(result.isHistoricalLow).toBe(false);
  });

  it('detects anomalous drop (>30%)', () => {
    const result = analyzePriceChange('199.00', '99.00', '140.00');
    expect(result.type).toBe('anomalous_drop');
    expect(result.dropPercent).toBeCloseTo(50.25, 1);
  });

  it('detects new historical low', () => {
    const result = analyzePriceChange('199.00', '130.00', '140.00');
    expect(result.isHistoricalLow).toBe(true);
  });

  it('detects no change', () => {
    const result = analyzePriceChange('199.00', '199.00', '140.00');
    expect(result.type).toBe('no_change');
  });

  it('detects price increase', () => {
    const result = analyzePriceChange('199.00', '249.00', '140.00');
    expect(result.type).toBe('price_increase');
  });

  it('handles null previous price (first scrape)', () => {
    const result = analyzePriceChange(null, '199.00', null);
    expect(result.type).toBe('first_price');
  });
});
