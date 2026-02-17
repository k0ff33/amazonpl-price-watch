interface PriceAlertInput {
  title: string;
  asin: string;
  oldPrice: string | null;
  newPrice: string;
  isHistoricalLow: boolean;
  unverified: boolean;
  associateTag: string;
}

export function formatPriceAlert(input: PriceAlertInput): string {
  const { title, asin, oldPrice, newPrice, isHistoricalLow, unverified, associateTag } = input;
  const link = `https://www.amazon.pl/dp/${asin}?tag=${associateTag}`;

  let prefix = '';
  if (unverified) prefix = 'Unverified price drop - confirming...\n\n';

  let body = '';
  if (oldPrice) {
    const drop = (((parseFloat(oldPrice) - parseFloat(newPrice)) / parseFloat(oldPrice)) * 100).toFixed(0);
    body = `${title}\n${oldPrice} PLN → ${newPrice} PLN (-${drop}%)`;
  } else {
    body = `${title}\nPrice: ${newPrice} PLN`;
  }

  if (isHistoricalLow) {
    body += '\nNew all-time low!';
  }

  const disclosure = '\n\nAs an Amazon Associate, I earn from qualifying purchases.';

  return `${prefix}${body}\n\n[Buy on Amazon.pl](${link})${disclosure}`;
}

export function formatAdminAlert(
  asin: string,
  title: string,
  oldPrice: string | null,
  newPrice: string,
  reason: 'anomalous_drop' | 'amazon_blocked',
): string {
  if (reason === 'anomalous_drop') {
    return `REVIEW: Anomalous drop on ${asin}\n${title}\n${oldPrice} → ${newPrice} PLN\nhttps://www.amazon.pl/dp/${asin}`;
  }
  return `ALERT: Amazon blocked for ${asin}\n${title}\nhttps://www.amazon.pl/dp/${asin}`;
}
