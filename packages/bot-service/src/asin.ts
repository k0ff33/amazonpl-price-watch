const ASIN_REGEX = /amazon\.pl\/(?:.*\/)?dp\/([A-Z0-9]{10})/i;
const AMZN_EU_REGEX = /https?:\/\/(?:www\.)?amzn\.eu\/[^\s]+/i;
const SHORT_LINK_TIMEOUT_MS = 5000;
const MAX_SHORT_LINK_REDIRECT_HOPS = 3;

function isAmznEuHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'amzn.eu' || host.endsWith('.amzn.eu');
  } catch {
    return false;
  }
}

export function extractAsin(url: string): string | null {
  const match = url.match(ASIN_REGEX);
  return match ? match[1].toUpperCase() : null;
}

export async function resolveAmznEuShortLink(shortLink: string): Promise<string | null> {
  let currentUrl = shortLink;

  for (let hop = 0; hop < MAX_SHORT_LINK_REDIRECT_HOPS; hop += 1) {
    try {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(SHORT_LINK_TIMEOUT_MS),
      });
      const location = response.headers.get('location');
      if (!location) return null;

      const nextUrl = new URL(location, currentUrl).toString();
      if (!isAmznEuHost(nextUrl)) {
        return nextUrl;
      }

      currentUrl = nextUrl;
    } catch {
      return null;
    }
  }

  return null;
}

export async function extractAsinFromMessage(
  text: string,
  resolveShortLink: (url: string) => Promise<string | null> = resolveAmznEuShortLink,
): Promise<string | null> {
  const directAsin = extractAsin(text);
  if (directAsin) return directAsin;

  const shortLink = text.match(AMZN_EU_REGEX)?.[0];
  if (!shortLink) return null;

  const resolvedUrl = await resolveShortLink(shortLink);
  return resolvedUrl ? extractAsin(resolvedUrl) : null;
}
