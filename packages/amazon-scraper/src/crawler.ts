import { PlaywrightCrawler, ProxyConfiguration, createPlaywrightRouter } from 'crawlee';

export function createAmazonCrawler(proxyUrl?: string) {
  const proxyConfiguration = proxyUrl
    ? new ProxyConfiguration({ proxyUrls: [proxyUrl] })
    : undefined;

  const router = createPlaywrightRouter();

  router.addDefaultHandler(async ({ page, request, log }) => {
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

    // Check for CAPTCHA / block
    const blocked = await page.$('form[action="/errors/validateCaptcha"]');
    if (blocked) {
      request.userData.blocked = true;
      log.warning(`Blocked on ${request.url}`);
      return;
    }

    // Extract price
    // .a-price-whole returns "1 171," (with non-breaking space + trailing comma)
    const wholePrice = await page
      .$eval('.a-price-whole', (el) => el.textContent?.trim())
      .catch(() => null);
    const fractionPrice = await page
      .$eval('.a-price-fraction', (el) => el.textContent?.trim())
      .catch(() => null);

    let price: string | null = null;
    if (wholePrice) {
      const whole = wholePrice.replace(/[\s,.\u00A0]/g, ''); // strip spaces, commas, dots, NBSP
      const fraction = fractionPrice?.replace(/[\s,.\u00A0]/g, '') || '00';
      price = `${whole}.${fraction}`;
    }

    // Extract stock status — check for buy box buttons (NOT #availability text)
    const hasAddToCart = (await page.$('#add-to-cart-button')) !== null;
    const hasBuyNow = (await page.$('#buy-now-button')) !== null;
    const isInStock = hasAddToCart || hasBuyNow;

    // Extract title
    const title = await page
      .$eval('#productTitle', (el) => el.textContent?.trim())
      .catch(() => null);

    request.userData.result = { price, isInStock, title };
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

  return { crawler, router };
}
