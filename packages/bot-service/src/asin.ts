const ASIN_REGEX = /amazon\.pl\/(?:.*\/)?dp\/([A-Z0-9]{10})/i;

export function extractAsin(url: string): string | null {
  const match = url.match(ASIN_REGEX);
  return match ? match[1].toUpperCase() : null;
}
