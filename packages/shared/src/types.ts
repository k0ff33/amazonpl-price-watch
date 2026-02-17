export interface PriceCheckJob {
  asin: string;
}

export interface AmazonScrapeJob {
  asin: string;
  currentPrice: string | null;
}

export interface PriceChangedJob {
  asin: string;
  oldPrice: string | null;
  newPrice: string;
  source: 'creators_api' | 'amazon_scraper' | 'ceneo';
  isInStock: boolean;
  unverified: boolean;
}

export interface CeneoVerifyJob {
  asin: string;
  title: string;
  expectedPrice: string;
  ceneoId: string | null;
  reason: 'anomalous_drop' | 'amazon_blocked';
}

export interface CeneoResultJob {
  asin: string;
  confirmed: boolean;
  ceneoPrice: string | null;
  ceneoId: string | null;
}

export interface NotifyUserJob {
  telegramChatId: number;
  message: string;
}
