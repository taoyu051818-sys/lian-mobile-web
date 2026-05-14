export const CLIENT_ID_KEY = "lian.clientId";

let memoryClientId: string | null = null;

function createClientId(): string {
  try {
    const next = globalThis.crypto?.randomUUID?.();
    if (next) return next;
  } catch {
    // Ignore crypto access errors and fall back to a timestamp-based id.
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;

  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredClientId(storage: Storage | null): string | null {
  if (!storage) return null;

  try {
    return storage.getItem(CLIENT_ID_KEY);
  } catch {
    return null;
  }
}

function writeStoredClientId(storage: Storage | null, clientId: string) {
  if (!storage) return;

  try {
    storage.setItem(CLIENT_ID_KEY, clientId);
  } catch {
    // Ignore storage write errors and keep the in-memory fallback alive.
  }
}

export function ensureClientId(storage?: Storage | null): string {
  const resolvedStorage = resolveStorage(storage);
  const existing = readStoredClientId(resolvedStorage) ?? memoryClientId;

  if (existing) {
    memoryClientId = existing;
    return existing;
  }

  const next = createClientId();
  memoryClientId = next;
  writeStoredClientId(resolvedStorage, next);
  return next;
}
