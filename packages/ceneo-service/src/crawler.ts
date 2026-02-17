import { CheerioCrawler, createCheerioRouter } from 'crawlee';
import { ImpitHttpClient } from '@crawlee/impit-client';

export interface CeneoResult {
  amazonFound: boolean;
  ceneoPrice: string | null;
}

export function createCeneoCrawler() {
  const results = new Map<string, CeneoResult>();

  const router = createCheerioRouter();

  router.addDefaultHandler(async ({ $, request, log }) => {
    const asin = request.userData.asin as string;
    log.info(`Checking Ceneo: ${request.url}`);

    // Find Amazon.pl offer (shop ID 42774)
    const amazonOffer = $('[data-shopurl*="amazon.pl"], [data-shop-id="42774"]');

    if (amazonOffer.length > 0) {
      const priceText = amazonOffer.closest('.product-offer').find('.price-format').text().trim();
      const price = priceText.replace(/[^\d,]/g, '').replace(',', '.');
      results.set(asin, { amazonFound: true, ceneoPrice: price || null });
      return;
    }

    // Fallback: search by shop name text
    const allOffers = $('.product-offers .product-offer');
    let found = false;

    allOffers.each((_, el) => {
      const shopName = $(el).find('.product-offer__store__name, .js_store-name').text().trim().toLowerCase();
      if (shopName.includes('amazon')) {
        const priceText = $(el).find('.product-offer__price .price-format').text().trim();
        const price = priceText.replace(/[^\d,]/g, '').replace(',', '.');
        results.set(asin, { amazonFound: true, ceneoPrice: price || null });
        found = true;
        return false; // break
      }
    });

    if (!found) {
      results.set(asin, { amazonFound: false, ceneoPrice: null });
    }
  });

  const crawler = new CheerioCrawler({
    requestHandler: router,
    httpClient: new ImpitHttpClient({ browser: 'firefox' }),
    maxConcurrency: 3,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 15,
  });

  return { crawler, results };
}
