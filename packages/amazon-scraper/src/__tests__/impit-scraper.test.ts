import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { scrapeAmazonWithImpit } from '../impit-scraper.js';

function startFakeProductServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head><title>Test Product - Amazon.pl</title></head>
        <body>
          <span id="productTitle">Test Product</span>
          <span id="add-to-cart-button"></span>
        </body>
      </html>
    `);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
  });
}

describe('scrapeAmazonWithImpit', () => {
  it('returns a result for two consecutive calls with the same URL', async () => {
    const { url, close } = await startFakeProductServer();
    try {
      const asin = 'B00TESTFIX';
      const productUrl = `${url}/dp/${asin}`;

      const result1 = await scrapeAmazonWithImpit({ asin, url: productUrl });
      expect(result1, 'first call should return a result').toBeDefined();

      // Before the fix this throws: "No scrape result for ASIN B00TESTFIX via Impit crawler"
      // because Crawlee's shared RequestQueue has already marked the URL as handled.
      const result2 = await scrapeAmazonWithImpit({ asin, url: productUrl });
      expect(result2, 'second call with same URL must not throw due to deduplication').toBeDefined();
    } finally {
      await close();
    }
  }, 30_000);
});
