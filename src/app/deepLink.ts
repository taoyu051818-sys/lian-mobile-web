/**
 * Pure parsing/building helpers for the `#/post/{tid}` deep link.
 *
 * The app routes on `window.location.hash` (no vue-router); both the publish
 * success link and the share helper produce `#/post/{tid}` URLs, but until
 * now nothing was parsing them on load. This module is the single source of
 * truth for that hash shape — kept pure (no DOM access) so it can be tested
 * directly and reused by the composable that owns the live `window.location`
 * subscription.
 */

const POST_HASH_PATTERN = /^#?\/post\/(\d+)(?:[/?#].*)?$/;

export interface DeepLink {
  view: "post-detail";
  tid: number;
}

/**
 * Parse a hash string (with or without leading `#`) into a DeepLink. Returns
 * `null` for any value that does not match the `#/post/{tid}` shape, or for a
 * non-positive tid.
 */
export function parseDeepLink(hash: string | null | undefined): DeepLink | null {
  if (!hash) return null;
  const match = POST_HASH_PATTERN.exec(hash.trim());
  if (!match) return null;
  const tid = Number(match[1]);
  if (!Number.isFinite(tid) || tid <= 0) return null;
  return { view: "post-detail", tid };
}

/** Build the hash fragment (with leading `#`) for a post detail link. */
export function buildPostDetailHash(tid: number): string {
  return `#/post/${tid}`;
}
