import type { ScrapeResult } from './crawler.js';

interface ScrapeWithFallbackInput {
  impitDirect: () => Promise<ScrapeResult>;
  impitProxy?: () => Promise<ScrapeResult>;
  playwrightProxy?: () => Promise<ScrapeResult>;
}

interface ScrapeWithFallbackOutput {
  result: ScrapeResult;
  directBlocked: boolean;
  usedProxyFallback: boolean;
  usedPlaywrightFallback: boolean;
  strategy: 'impit_direct' | 'impit_proxy' | 'playwright_proxy';
}

function needsFallback(result: ScrapeResult): boolean {
  return Boolean(result.blocked) || result.price === null;
}

export async function scrapeWithFallback({
  impitDirect,
  impitProxy,
  playwrightProxy,
}: ScrapeWithFallbackInput): Promise<ScrapeWithFallbackOutput> {
  const directResult = await impitDirect();
  const directBlocked = Boolean(directResult.blocked);

  if (!needsFallback(directResult)) {
    return {
      result: directResult,
      directBlocked: false,
      usedProxyFallback: false,
      usedPlaywrightFallback: false,
      strategy: 'impit_direct',
    };
  }

  if (!impitProxy) {
    return {
      result: directResult,
      directBlocked,
      usedProxyFallback: false,
      usedPlaywrightFallback: false,
      strategy: 'impit_direct',
    };
  }

  const impitProxyResult = await impitProxy();
  if (!needsFallback(impitProxyResult)) {
    return {
      result: impitProxyResult,
      directBlocked,
      usedProxyFallback: true,
      usedPlaywrightFallback: false,
      strategy: 'impit_proxy',
    };
  }

  if (!playwrightProxy) {
    return {
      result: impitProxyResult,
      directBlocked,
      usedProxyFallback: true,
      usedPlaywrightFallback: false,
      strategy: 'impit_proxy',
    };
  }

  const playwrightProxyResult = await playwrightProxy();
  return {
    result: playwrightProxyResult,
    directBlocked,
    usedProxyFallback: true,
    usedPlaywrightFallback: true,
    strategy: 'playwright_proxy',
  };
}
