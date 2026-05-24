/**
 * Pure parsing/building helpers for the SPA's hash-based deep links.
 *
 * The app routes on `window.location.hash` (no vue-router); two shapes are
 * supported:
 *   - `#/post/{tid}` — opens the post detail panel (always inside the feed tab)
 *   - `#/{view}` — selects one of the top-level tabs or a "secret" view:
 *       five visible tabs: `feed | map | publish | messages | profile`
 *       hidden views:      `admin | verification | merchant | errand-order | runner`
 *
 *     Secret views are reachable by direct hash but intentionally absent from
 *     the bottom tab bar (`appViews` in view-types.ts). Refreshing one of
 *     their URLs must still mount the right component, so the parser has to
 *     accept the full set of `AppViewKey` values.
 *
 * This module is the single source of truth for those hash shapes — kept pure
 * (no DOM access) so it can be tested directly and reused by the composable
 * that owns the live `window.location` subscription.
 */

import type { AppViewKey } from "./view-types";

const POST_HASH_PATTERN = /^#?\/post\/(\d+)(?:[/?#].*)?$/;
const VIEW_HASH_PATTERN =
  /^#?\/(feed|map|publish|messages|profile|admin|verification|merchant|errand-order|runner)\/?(?:[?#].*)?$/;

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

/**
 * Parse the query-string tail of a hash (`#/view?key=value&...`) into a flat
 * record. Returns an empty object when the hash has no `?` segment, when the
 * value is null/empty, or when parsing fails — callers can read keys with
 * `result.key === "1"` without null-guarding.
 *
 * Kept alongside `parseDeepLink` rather than embedded in it because the view
 * matcher discards the query tail by design (the view selection has never
 * depended on query). The picker-mode flag for the publish→map flow is the
 * first concrete consumer; future feature flags can read the same surface.
 */
export function parseDeepLinkQuery(hash: string | null | undefined): Record<string, string> {
  if (!hash) return {};
  const trimmed = hash.trim();
  const queryStart = trimmed.indexOf("?");
  if (queryStart < 0) return {};
  const queryTail = trimmed.slice(queryStart + 1);
  // Strip a trailing fragment (`#section`) — unusual inside a hash, but the
  // URLSearchParams parser would treat it as part of the last value otherwise.
  const fragmentIndex = queryTail.indexOf("#");
  const queryString = fragmentIndex >= 0 ? queryTail.slice(0, fragmentIndex) : queryTail;
  if (!queryString) return {};
  const result: Record<string, string> = {};
  try {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      // First occurrence wins. Duplicate keys (`?a=1&a=2`) are not part of any
      // contract this app exposes, so deterministic "first writer" matches
      // most parser conventions and keeps the surface predictable.
      if (!(key in result)) result[key] = value;
    });
  } catch {
    /* swallow — malformed query yields an empty record, matching null/empty */
  }
  return result;
}

/**
 * Build the `#/map?picker=1` hash that the publish form pushes when the user
 * taps "在地图上选". Sits alongside `buildViewHash` so callers go through one
 * canonical builder per shape (no inline string concat at call sites).
 */
export function buildMapPickerHash(): string {
  return "#/map?picker=1";
}
