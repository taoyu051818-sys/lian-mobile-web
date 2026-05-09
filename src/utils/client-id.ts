export const CLIENT_ID_KEY = "lian.clientId";

export function ensureClientId(storage: Storage = localStorage): string {
  const existing = storage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(CLIENT_ID_KEY, next);
  return next;
}
