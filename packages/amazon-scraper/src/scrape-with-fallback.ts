import type { ScrapeResult } from './crawler.js';

interface ScrapeRunner {
  run: (requests: Array<{ url: string; userData: { asin: string } }>) => Promise<unknown>;
}

interface ScrapeTarget {
  crawler: ScrapeRunner;
  results: Map<string, ScrapeResult>;
}

interface ScrapeWithFallbackInput {
  asin: string;
  url: string;
  direct: ScrapeTarget;
  proxy?: ScrapeTarget;
}

interface ScrapeWithFallbackOutput {
  result: ScrapeResult;
  directBlocked: boolean;
  usedProxyFallback: boolean;
}

async function runAndGetResult({
  asin,
  url,
  target,
  source,
}: {
  asin: string;
  url: string;
  target: ScrapeTarget;
  source: 'direct' | 'proxy';
}): Promise<ScrapeResult> {
  await target.crawler.run([{ url, userData: { asin } }]);
  const scrapeResult = target.results.get(asin);
  target.results.delete(asin);

  if (!scrapeResult) {
    throw new Error(`No scrape result for ASIN ${asin} via ${source} crawler`);
  }

  return scrapeResult;
}

export async function scrapeWithFallback({
  asin,
  url,
  direct,
  proxy,
}: ScrapeWithFallbackInput): Promise<ScrapeWithFallbackOutput> {
  const directResult = await runAndGetResult({ asin, url, target: direct, source: 'direct' });
  const directBlocked = Boolean(directResult.blocked);

  if (!directBlocked) {
    return { result: directResult, directBlocked: false, usedProxyFallback: false };
  }

  if (!proxy) {
    return { result: directResult, directBlocked: true, usedProxyFallback: false };
  }

  const proxyResult = await runAndGetResult({ asin, url, target: proxy, source: 'proxy' });
  return { result: proxyResult, directBlocked: true, usedProxyFallback: true };
}
