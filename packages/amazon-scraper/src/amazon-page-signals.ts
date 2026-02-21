export const AMAZON_SELECTORS = {
  productTitle: '#productTitle',
  addToCartButton: '#add-to-cart-button',
  buyNowButton: '#buy-now-button',
  captchaForm: 'form[action="/errors/validateCaptcha"]',
  hiddenPriceValue: 'input#priceValue',
  primaryPrice: [
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePrice_desktop .a-price .a-offscreen',
    '#apex_desktop .apex-core-price-identifier .a-price .a-offscreen',
    '#tp_price_block_total_price_ww .a-offscreen',
  ] as const,
} as const;

const SOFT_BLOCK_PATTERNS = [
  'robot check',
  'verify you are human',
  "sorry, we just need to make sure you're not a robot",
  'to discuss automated access to amazon data',
  'enter the characters you see below',
  '/errors/validatecaptcha',
];

const SOFT_BLOCK_WEAK_HINTS = ['captcha', 'robot', 'automated access', 'verify you are human'];

export interface SoftBlockSignals {
  titleText: string | null;
  bodyText: string | null;
  hasProductTitle: boolean;
  hasPrimaryPrice: boolean;
  hasAddToCart: boolean;
  hasBuyNow: boolean;
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizePrice(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/\d[\d\s\u00A0.,]*/);
  if (!match) return null;

  let numeric = match[0].replace(/[\s\u00A0]/g, '');
  if (numeric.includes(',')) {
    numeric = numeric.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = numeric.split('.');
    if (parts.length > 2) {
      const decimal = parts.pop() ?? '';
      numeric = `${parts.join('')}.${decimal}`;
    }
  }

  const parsed = Number.parseFloat(numeric);
  if (Number.isNaN(parsed)) return null;
  return parsed.toFixed(2);
}

export function isBlockedStatus(statusCode: number | null | undefined): boolean {
  return statusCode === 403 || statusCode === 503;
}

function normalizeForMatch(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isSoftBlockedSignals(signals: SoftBlockSignals): boolean {
  const title = normalizeForMatch(signals.titleText);
  const body = normalizeForMatch(signals.bodyText);

  const hasExplicitSoftBlockPattern = SOFT_BLOCK_PATTERNS.some(
    (pattern) => title.includes(pattern) || body.includes(pattern),
  );
  if (hasExplicitSoftBlockPattern) {
    return true;
  }

  const hasCoreProductSignals =
    signals.hasProductTitle ||
    signals.hasPrimaryPrice ||
    signals.hasAddToCart ||
    signals.hasBuyNow;

  if (hasCoreProductSignals) {
    return false;
  }

  return SOFT_BLOCK_WEAK_HINTS.some((pattern) => body.includes(pattern));
}
