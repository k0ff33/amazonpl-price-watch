export interface NextCheckIntervalInput {
  price: number;
  subscriberCount: number;
  volatilityScore: number;
}

export const DEFAULT_NEXT_CHECK_INTERVAL_MINUTES = 240;

export function calculateNextCheckInterval(input: NextCheckIntervalInput): number {
  const { price, subscriberCount, volatilityScore } = input;

  if (price < 30) return 24 * 60;
  if (subscriberCount > 100) return 15;
  if (volatilityScore > 0.8) return 30;
  return DEFAULT_NEXT_CHECK_INTERVAL_MINUTES;
}
