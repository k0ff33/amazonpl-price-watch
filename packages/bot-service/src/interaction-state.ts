const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

type PendingPriceAction = {
  type: 'set_target_price';
  asin: string;
  expiresAt: number;
};

const pendingActions = new Map<string, PendingPriceAction>();

function key(chatId: number, ownerUserId: number) {
  return `${chatId}:${ownerUserId}`;
}

export function setPendingTargetPrice(chatId: number, ownerUserId: number, asin: string) {
  pendingActions.set(key(chatId, ownerUserId), {
    type: 'set_target_price',
    asin,
    expiresAt: Date.now() + PENDING_ACTION_TTL_MS,
  });
}

export function getPendingTargetPrice(chatId: number, ownerUserId: number): string | null {
  const entry = pendingActions.get(key(chatId, ownerUserId));
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    pendingActions.delete(key(chatId, ownerUserId));
    return null;
  }

  if (entry.type !== 'set_target_price') return null;
  return entry.asin;
}

export function clearPendingAction(chatId: number, ownerUserId: number) {
  pendingActions.delete(key(chatId, ownerUserId));
}
