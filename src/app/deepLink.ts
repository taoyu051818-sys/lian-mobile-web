/**
 * Pure parsing/building helpers for the SPA's hash-based deep links.
 *
 * The app routes on `window.location.hash` (no vue-router); two shapes are
 * supported:
 *   - `#/post/{tid}` — opens the post detail panel (always inside the feed tab)
 *   - `#/{view}` — selects one of the five top-level tabs
 *     (`feed | map | publish | messages | profile`)
 *
 * This module is the single source of truth for those hash shapes — kept pure
 * (no DOM access) so it can be tested directly and reused by the composable
 * that owns the live `window.location` subscription.
 */

import type { AppViewKey } from "./view-types";

const POST_HASH_PATTERN = /^#?\/post\/(\d+)(?:[/?#].*)?$/;
const VIEW_HASH_PATTERN = /^#?\/(feed|map|publish|messages|profile)\/?(?:[?#].*)?$/;

export type DeepLink = { view: "post-detail"; tid: number } | { view: AppViewKey };

/**
 * Parse a hash string (with or without leading `#`) into a DeepLink. Post
 * detail wins precedence over view hashes — `#/post/{tid}` always resolves to
 * the detail panel even if a tab name happens to also match. Returns `null`
 * for any value that does not match either shape.
 */
export function parseDeepLink(hash: string | null | undefined): DeepLink | null {
  if (!hash) return null;
  const trimmed = hash.trim();
  const postMatch = POST_HASH_PATTERN.exec(trimmed);
  if (postMatch) {
    const tid = Number(postMatch[1]);
    if (!Number.isFinite(tid) || tid <= 0) return null;
    return { view: "post-detail", tid };
  }
  const viewMatch = VIEW_HASH_PATTERN.exec(trimmed);
  if (viewMatch) {
    return { view: viewMatch[1] as AppViewKey };
  }
  return null;
}

/** Build the hash fragment (with leading `#`) for a post detail link. */
export function buildPostDetailHash(tid: number): string {
  return `#/post/${tid}`;
}

/** Build the hash fragment (with leading `#`) for a top-level tab. */
export function buildViewHash(view: AppViewKey): string {
  return `#/${view}`;
}
