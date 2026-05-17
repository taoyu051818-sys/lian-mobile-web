/**
 * Centralized localStorage key surface for the Vue canary app.
 *
 * Every key written by Vue source code is declared here so that
 * key collisions and naming drift are visible in one module.
 * Legacy public/ scripts maintain their own copies; this module
 * is the single authority for the Vue surface.
 */

export { CLIENT_ID_KEY, ensureClientId } from "./clientIdentity";

import type { FeedItemId } from "../types/feed";

export const READ_HISTORY_KEY = "lian.readHistory";
export const HOME_UPDATE_PROBE_PREFIX = "lian.homeUpdateProbe";

export interface ReadHistoryEntry {
  tid: FeedItemId;
  lastViewedAt?: string;
}

function normalizeReadHistoryEntry(value: unknown): ReadHistoryEntry | null {
  if (!value || typeof value !== "object") return null;

  const tid = Number((value as { tid?: unknown }).tid);
  if (!Number.isFinite(tid)) return null;

  const lastViewedAt =
    typeof (value as { lastViewedAt?: unknown }).lastViewedAt === "string"
      ? (value as { lastViewedAt: string }).lastViewedAt
      : undefined;

  return lastViewedAt ? { tid, lastViewedAt } : { tid };
}

export function readHistoryEntries(storage: Storage = localStorage): ReadHistoryEntry[] {
  try {
    const raw = storage.getItem(READ_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => normalizeReadHistoryEntry(entry))
      .filter((entry): entry is ReadHistoryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

export function getRecentReadHistoryIds(storage: Storage = localStorage, limit = 50): FeedItemId[] {
  return readHistoryEntries(storage)
    .slice()
    .reverse()
    .map((entry) => entry.tid)
    .slice(0, limit);
}

export function readHistoryQuery(storage: Storage = localStorage): string {
  return readHistoryEntries(storage)
    .map((entry) => String(entry.tid))
    .filter(Boolean)
    .join(",");
}

export function rememberReadItem(id: FeedItemId, storage: Storage = localStorage): void {
  try {
    const normalizedId = id == null ? "" : String(id);
    const history = readHistoryEntries(storage);
    const nextHistory = history.filter((entry) => String(entry.tid) !== normalizedId);
    nextHistory.push({ tid: normalizedId, lastViewedAt: new Date().toISOString() });
    storage.setItem(READ_HISTORY_KEY, JSON.stringify(nextHistory.slice(-500)));
  } catch {
    // Reading history should never block opening a card.
  }
}
