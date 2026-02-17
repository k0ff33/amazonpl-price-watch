export type PriceChangeType =
  | 'no_change'
  | 'normal_drop'
  | 'anomalous_drop'
  | 'price_increase'
  | 'first_price';

export interface PriceChangeResult {
  type: PriceChangeType;
  dropPercent: number;
  isHistoricalLow: boolean;
}

const ANOMALOUS_THRESHOLD = 30; // percent

export function analyzePriceChange(
  oldPrice: string | null,
  newPrice: string,
  historicalLow: string | null,
): PriceChangeResult {
  if (oldPrice === null) {
    return { type: 'first_price', dropPercent: 0, isHistoricalLow: historicalLow === null };
  }

  const oldNum = parseFloat(oldPrice);
  const newNum = parseFloat(newPrice);
  const lowNum = historicalLow ? parseFloat(historicalLow) : Infinity;

  if (newNum >= oldNum) {
    return {
      type: newNum === oldNum ? 'no_change' : 'price_increase',
      dropPercent: 0,
      isHistoricalLow: newNum < lowNum,
    };
  }

  const dropPercent = ((oldNum - newNum) / oldNum) * 100;
  const isHistoricalLow = newNum < lowNum;
  const type = dropPercent > ANOMALOUS_THRESHOLD ? 'anomalous_drop' : 'normal_drop';

  return { type, dropPercent, isHistoricalLow };
}
