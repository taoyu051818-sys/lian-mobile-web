/**
 * Centralized localStorage key surface for the Vue canary app.
 *
 * Every key written by Vue source code is declared here so that
 * key collisions and naming drift are visible in one module.
 * Legacy public/ scripts maintain their own copies; this module
 * is the single authority for the Vue surface.
 */

import type { FeedItemId } from "../types/feed";

export const CLIENT_ID_KEY = "lian.clientId";
export const READ_HISTORY_KEY = "lian.readHistory";
export const HOME_UPDATE_PROBE_PREFIX = "lian.homeUpdateProbe";

export interface ReadHistoryEntry {
  tid: FeedItemId;
  lastViewedAt?: string;
}

export function ensureClientId(storage: Storage = localStorage): string {
  const existing = storage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(CLIENT_ID_KEY, next);
  return next;
}

function normalizeReadHistoryEntry(value: unknown): ReadHistoryEntry | null {
  if (!value || typeof value !== "object") return null;

  const tid = Number((value as { tid?: unknown }).tid);
  if (!Number.isFinite(tid)) return null;

  const lastViewedAt = typeof (value as { lastViewedAt?: unknown }).lastViewedAt === "string"
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
