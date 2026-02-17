export function buildCeneoSearchUrl(title: string): string {
  const query = title.replace(/\s+/g, '+');
  return `https://www.ceneo.pl/szukaj-${query}`;
}

export function parseCeneoIdFromUrl(url: string): string | null {
  const match = url.match(/ceneo\.pl\/(\d+)/);
  return match ? match[1] : null;
}
