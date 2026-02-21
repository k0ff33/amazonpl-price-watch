import { ImpitHttpClient } from '@crawlee/impit-client';
import { CheerioCrawler, ProxyConfiguration } from 'crawlee';
import type { CheerioCrawlingContext } from 'crawlee';
import type { ScrapeResult } from './crawler.js';
import {
  AMAZON_SELECTORS,
  isBlockedStatus,
  isSoftBlockedSignals,
  normalizePrice,
  normalizeText,
} from './amazon-page-signals.js';

type CheerioAPI = CheerioCrawlingContext['$'];

function extractPrimaryPrice($: CheerioAPI): string | null {
  for (const selector of AMAZON_SELECTORS.primaryPrice) {
    const text = normalizeText($(selector).first().text());
    if (text) {
      return normalizePrice(text);
    }
  }

  const hiddenPriceValue = normalizeText($(AMAZON_SELECTORS.hiddenPriceValue).attr('value') ?? '');
  return normalizePrice(hiddenPriceValue);
}

export function extractAmazonProductData($: CheerioAPI): ScrapeResult {
  const title = normalizeText($(AMAZON_SELECTORS.productTitle).first().text()) || null;
  const hasAddToCart = $(AMAZON_SELECTORS.addToCartButton).length > 0;
  const hasBuyNow = $(AMAZON_SELECTORS.buyNowButton).length > 0;

  return {
    price: extractPrimaryPrice($),
    isInStock: hasAddToCart || hasBuyNow,
    title,
  };
}

export function isCaptchaPage($: CheerioAPI): boolean {
  return $(AMAZON_SELECTORS.captchaForm).length > 0;
}

export function isSoftBlockedPage($: CheerioAPI): boolean {
  const hasAddToCart = $(AMAZON_SELECTORS.addToCartButton).length > 0;
  const hasBuyNow = $(AMAZON_SELECTORS.buyNowButton).length > 0;

  return isSoftBlockedSignals({
    titleText: normalizeText($('title').first().text()) || null,
    bodyText: normalizeText($('body').text()) || null,
    hasProductTitle: $(AMAZON_SELECTORS.productTitle).length > 0,
    hasPrimaryPrice: extractPrimaryPrice($) !== null,
    hasAddToCart,
    hasBuyNow,
  });
}

export async function scrapeAmazonWithImpit({
  asin,
  url,
  proxyUrl,
}: {
  asin: string;
  url: string;
  proxyUrl?: string;
}): Promise<ScrapeResult> {
  const results = new Map<string, ScrapeResult>();
  const proxyConfiguration = proxyUrl
    ? new ProxyConfiguration({ proxyUrls: [proxyUrl] })
    : undefined;

  const crawler = new CheerioCrawler({
    httpClient: new ImpitHttpClient({ browser: 'chrome' }),
    proxyConfiguration,
    maxConcurrency: 1,
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: 30,
    requestHandler: async ({ $, response, request, log }) => {
      const statusCode = response?.statusCode;
      const blockedByStatus = isBlockedStatus(statusCode);
      const blockedByCaptcha = isCaptchaPage($);
      const blockedBySoftSignals = isSoftBlockedPage($);

      if (blockedByStatus || blockedByCaptcha || blockedBySoftSignals) {
        const reasons = [
          blockedByStatus && `status=${statusCode}`,
          blockedByCaptcha && 'captcha',
          blockedBySoftSignals && 'soft_block',
        ]
          .filter(Boolean)
          .join(', ');

        log.warning(
          `Blocked on ${request.url}${reasons ? ` (${reasons})` : ''}`,
        );
        results.set(asin, {
          price: null,
          isInStock: false,
          title: null,
          blocked: true,
        });
        return;
      }

      results.set(asin, extractAmazonProductData($));
    },
  });

  try {
    await crawler.run([
      {
        url,
        userData: { asin },
        headers: {
          'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      },
    ]);
    const scrapeResult = results.get(asin);
    if (!scrapeResult) {
      throw new Error(`No scrape result for ASIN ${asin} via Impit crawler`);
    }
    return scrapeResult;
  } finally {
    results.delete(asin);
    await crawler.teardown().catch(() => undefined);
  }
}
