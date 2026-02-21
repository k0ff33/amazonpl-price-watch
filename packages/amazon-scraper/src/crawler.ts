import { PlaywrightCrawler, ProxyConfiguration, createPlaywrightRouter } from 'crawlee';
import type { Page } from 'playwright';
import {
  AMAZON_SELECTORS,
  isBlockedStatus,
  isSoftBlockedSignals,
  normalizePrice,
} from './amazon-page-signals.js';

export interface ScrapeResult {
  price: string | null;
  isInStock: boolean;
  title: string | null;
  blocked?: boolean;
}

async function getFirstSelectorText(page: Page, selectors: readonly string[]): Promise<string | null> {
  for (const selector of selectors) {
    const text = await page
      .$eval(selector, (el) => el.textContent?.trim() ?? null)
      .catch(() => null);
    if (text) return text;
  }
  return null;
}

export function createAmazonCrawler(proxyUrl?: string) {
  /** Map from ASIN to scrape result, populated by handler, consumed by worker */
  const results = new Map<string, ScrapeResult>();
  const proxyConfiguration = proxyUrl
    ? new ProxyConfiguration({ proxyUrls: [proxyUrl] })
    : undefined;

  const router = createPlaywrightRouter();

  router.addDefaultHandler(async ({ page, request, response, log }) => {
    // Block non-essential resources to save bandwidth
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    log.info(`Scraping ${request.url}`);

    const asin = request.userData.asin as string;
    const statusCode = response?.status();
    const blockedByStatus = isBlockedStatus(statusCode);

    // Check for CAPTCHA / block
    const blockedByCaptcha = (await page.$(AMAZON_SELECTORS.captchaForm)) !== null;
    const hasProductTitle = (await page.$(AMAZON_SELECTORS.productTitle)) !== null;
    const hasAddToCart = (await page.$(AMAZON_SELECTORS.addToCartButton)) !== null;
    const hasBuyNow = (await page.$(AMAZON_SELECTORS.buyNowButton)) !== null;

    const primaryPriceText = await getFirstSelectorText(page, AMAZON_SELECTORS.primaryPrice);
    const hiddenPriceValue = await page
      .$eval(AMAZON_SELECTORS.hiddenPriceValue, (el) => (el.getAttribute('value') ?? '').trim())
      .catch(() => null);
    const price = normalizePrice(primaryPriceText ?? hiddenPriceValue);
    const hasPrimaryPrice = price !== null;

    const blockedBySoftSignals = isSoftBlockedSignals({
      titleText: await page.title().catch(() => null),
      bodyText: await page.locator('body').innerText().catch(() => null),
      hasProductTitle,
      hasPrimaryPrice,
      hasAddToCart,
      hasBuyNow,
    });

    if (blockedByStatus || blockedByCaptcha || blockedBySoftSignals) {
      request.userData.blocked = true;
      results.set(asin, { price: null, isInStock: false, title: null, blocked: true });
      const reasons = [
        blockedByStatus && `status=${statusCode}`,
        blockedByCaptcha && 'captcha',
        blockedBySoftSignals && 'soft_block',
      ]
        .filter(Boolean)
        .join(', ');
      log.warning(`Blocked on ${request.url}${reasons ? ` (${reasons})` : ''}`);
      return;
    }

    // Extract stock status — check for buy box buttons (NOT #availability text)
    const isInStock = hasAddToCart || hasBuyNow;

    // Extract title
    const title = await page
      .$eval(AMAZON_SELECTORS.productTitle, (el) => el.textContent?.trim())
      .catch(() => null);

    const scrapeResult: ScrapeResult = { price, isInStock, title };
    request.userData.result = scrapeResult;
    results.set(asin, scrapeResult);
  });

  const crawler = new PlaywrightCrawler({
    requestHandler: router,
    proxyConfiguration,
    maxConcurrency: 1,
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: 10 },
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 30,
    headless: true,
    launchContext: {
      launchOptions: {
        args: ['--disable-blink-features=AutomationControlled'],
      },
    },
  });

  return { crawler, router, results };
}

export async function scrapeAmazonWithPlaywright({
  asin,
  url,
  proxyUrl,
}: {
  asin: string;
  url: string;
  proxyUrl?: string;
}): Promise<ScrapeResult> {
  const { crawler, results } = createAmazonCrawler(proxyUrl);

  try {
    await crawler.run([{ url, userData: { asin } }]);
    const scrapeResult = results.get(asin);
    if (!scrapeResult) {
      throw new Error(`No scrape result for ASIN ${asin} via Playwright crawler`);
    }
    return scrapeResult;
  } finally {
    results.delete(asin);
    await crawler.teardown().catch(() => undefined);
  }
}
