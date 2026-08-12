/**
 * Centralized localStorage key surface for the Vue canary app.
 *
 * Every key written by Vue source code is declared here so that
 * key collisions and naming drift are visible in one module.
 * Legacy public/ scripts maintain their own copies; this module
 * is the single authority for the Vue surface.
 */

import type { FeedItemId } from "../types/feed";

export const LEGACY_READ_HISTORY_KEY = "lian.readHistory";
export const READ_HISTORY_KEY_PREFIX = "lian.readHistory.v2:";

export type GuestReadHistoryScope = { kind: "guest" };
export type AccountReadHistoryScope = { kind: "account"; userId: string };
export type ReadHistoryScope = GuestReadHistoryScope | AccountReadHistoryScope;

export const GUEST_READ_HISTORY_SCOPE: Readonly<GuestReadHistoryScope> = Object.freeze({
  kind: "guest",
});

export interface ReadHistoryEntry {
  tid: FeedItemId;
  lastViewedAt?: string;
}

export function accountReadHistoryScope(userId: string): AccountReadHistoryScope | null {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
  return normalizedUserId ? { kind: "account", userId: normalizedUserId } : null;
}

function readHistoryStorageKey(scope: ReadHistoryScope): string {
  return scope.kind === "guest"
    ? `${READ_HISTORY_KEY_PREFIX}guest`
    : `${READ_HISTORY_KEY_PREFIX}account:${encodeURIComponent(scope.userId)}`;
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

export function readHistoryEntries(
  scope: ReadHistoryScope,
  storage: Storage = localStorage,
): ReadHistoryEntry[] {
  try {
    const raw = storage.getItem(readHistoryStorageKey(scope));
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

export function getRecentReadHistoryIds(
  scope: ReadHistoryScope,
  storage: Storage = localStorage,
  limit = 50,
): FeedItemId[] {
  return readHistoryEntries(scope, storage)
    .slice()
    .reverse()
    .map((entry) => entry.tid)
    .slice(0, limit);
}

export function readHistoryQuery(scope: ReadHistoryScope, storage: Storage = localStorage): string {
  return readHistoryEntries(scope, storage)
    .map((entry) => String(entry.tid))
    .filter(Boolean)
    .join(",");
}

export function rememberReadItem(
  scope: ReadHistoryScope,
  id: FeedItemId,
  storage: Storage = localStorage,
): void {
  try {
    const normalizedId = id == null ? "" : String(id);
    const history = readHistoryEntries(scope, storage);
    const nextHistory = history.filter((entry) => String(entry.tid) !== normalizedId);
    nextHistory.push({ tid: Number(normalizedId), lastViewedAt: new Date().toISOString() });
    storage.setItem(readHistoryStorageKey(scope), JSON.stringify(nextHistory.slice(-500)));
  } catch {
    // Reading history should never block opening a card.
  }
}
