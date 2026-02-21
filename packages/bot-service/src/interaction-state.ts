const STATE_TTL_MS = 30 * 60 * 1000;

type UserInteractionState = {
  pendingTargetAsin?: string;
  lastTrackedAsin?: string;
  expiresAt: number;
};

const interactionState = new Map<string, UserInteractionState>();

function key(chatId: number, ownerUserId: number) {
  return `${chatId}:${ownerUserId}`;
}

function getOrCreateState(chatId: number, ownerUserId: number) {
  const stateKey = key(chatId, ownerUserId);
  const current = interactionState.get(stateKey);

  if (current && current.expiresAt >= Date.now()) {
    return current;
  }

  const created: UserInteractionState = { expiresAt: Date.now() + STATE_TTL_MS };
  interactionState.set(stateKey, created);
  return created;
}

function getValidState(chatId: number, ownerUserId: number): UserInteractionState | null {
  const stateKey = key(chatId, ownerUserId);
  const state = interactionState.get(stateKey);
  if (!state) return null;
  if (state.expiresAt < Date.now()) {
    interactionState.delete(stateKey);
    return null;
  }
  return state;
}

function touch(state: UserInteractionState) {
  state.expiresAt = Date.now() + STATE_TTL_MS;
}

export function setPendingTargetPrice(chatId: number, ownerUserId: number, asin: string) {
  const state = getOrCreateState(chatId, ownerUserId);
  state.pendingTargetAsin = asin;
  state.lastTrackedAsin = asin;
  touch(state);
}

export function getPendingTargetPrice(chatId: number, ownerUserId: number): string | null {
  const state = getValidState(chatId, ownerUserId);
  if (!state?.pendingTargetAsin) return null;
  touch(state);
  return state.pendingTargetAsin;
}

export function clearPendingAction(chatId: number, ownerUserId: number) {
  const state = getValidState(chatId, ownerUserId);
  if (!state) return;
  delete state.pendingTargetAsin;
  touch(state);
}

export function setLastTrackedAsin(chatId: number, ownerUserId: number, asin: string) {
  const state = getOrCreateState(chatId, ownerUserId);
  state.lastTrackedAsin = asin;
  touch(state);
}

export function getLastTrackedAsin(chatId: number, ownerUserId: number): string | null {
  const state = getValidState(chatId, ownerUserId);
  if (!state?.lastTrackedAsin) return null;
  touch(state);
  return state.lastTrackedAsin;
}
