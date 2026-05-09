/**
 * Centralized localStorage key surface for the Vue canary app.
 *
 * Every key written by Vue source code is declared here so that
 * key collisions and naming drift are visible in one module.
 * Legacy public/ scripts maintain their own copies; this module
 * is the single authority for the Vue surface.
 */

export const CLIENT_ID_KEY = "lian.clientId";
export const READ_HISTORY_KEY = "lian.readHistory";
export const HOME_UPDATE_PROBE_PREFIX = "lian.homeUpdateProbe";

export function ensureClientId(storage: Storage = localStorage): string {
  const existing = storage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(CLIENT_ID_KEY, next);
  return next;
}
