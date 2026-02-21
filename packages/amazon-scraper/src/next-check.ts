import {
  calculateNextCheckInterval,
  DEFAULT_NEXT_CHECK_INTERVAL_MINUTES,
} from '@liskobot/shared';

interface NextCheckAfterScrapeInput {
  scrapedPrice: string | null;
  currentPrice: string | null;
  subscriberCount: number | null;
  volatilityScore: string | null;
  now?: Date;
}

export function calculateNextCheckAtAfterScrape(input: NextCheckAfterScrapeInput): Date {
  const {
    scrapedPrice,
    currentPrice,
    subscriberCount,
    volatilityScore,
    now = new Date(),
  } = input;

  const effectivePrice = scrapedPrice ?? currentPrice;

  if (!effectivePrice) {
    return new Date(now.getTime() + DEFAULT_NEXT_CHECK_INTERVAL_MINUTES * 60_000);
  }

  const interval = calculateNextCheckInterval({
    price: parseFloat(effectivePrice),
    subscriberCount: subscriberCount ?? 0,
    volatilityScore: parseFloat(volatilityScore ?? '0'),
  });

  return new Date(now.getTime() + interval * 60_000);
}
