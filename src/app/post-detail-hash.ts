/**
 * Post-detail hash writer — `#/post/{tid}`.
 *
 * Pure history I/O. No module-scoped tid ref, no listener: the
 * detail-navigation FSM is the single source of truth for "which tid is open"
 * (see `detail-navigation/store.ts` and `detail-navigation/url-sync.ts`). This
 * module just exists so the FSM's history-push / history-clear effects don't
 * have to inline the URL plumbing.
 *
 * The view-hash side of the world lives in `view-hash.ts`; that's the only
 * module that owns `viewFromHash`. When `clearPostDetailHash` runs while a
 * post hash is active, it falls back to the current view-hash value so the
 * address bar stays consistent with the visible tab.
 */

import { buildPostDetailHash, buildViewHash, parseDeepLink } from "./deepLink";
import { getViewFromHashRef } from "./view-hash";

function readHashFromWindow(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash || "";
}

/**
 * Push `#/post/{tid}` onto history (or replace, when `replace` is set).
 *
 * Used by the detail-navigation store as a `history-push` side effect when the
 * FSM transitions into a loading/ready state for a new tid. The reducer's
 * url-sync action is idempotent on the same tid, so a hashchange fired by this
 * push is dropped instead of re-entering the open path.
 */
export function pushPostDetailHash(tid: number, options: { replace?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const target = `${window.location.pathname}${window.location.search}${buildPostDetailHash(tid)}`;
  // history.pushState/replaceState can throw in sandboxed iframes or when the
  // page exceeds the per-document history quota. The FSM stays authoritative —
  // the URL bar will be out of sync until the next successful navigation.
  try {
    if (options.replace) {
      window.history.replaceState(window.history.state, "", target);
    } else {
      window.history.pushState(window.history.state, "", target);
    }
  } catch {
    /* swallow — FSM state stays authoritative */
  }
}

/**
 * Strip `#/post/{tid}` from the URL when the detail panel closes from inside
 * the SPA. replaceState is intentional — `history.back()` would unwind any
 * other entries the user navigated through (tab switches, etc.).
 *
 * If a view tab is currently selected, the URL is replaced with `#/{view}` so
 * the address bar stays consistent with the visible tab.
 */
export function clearPostDetailHash() {
  if (typeof window === "undefined") return;
  const link = parseDeepLink(readHashFromWindow());
  if (!link || link.view !== "post-detail") return;
  const view = getViewFromHashRef().value;
  const target = `${window.location.pathname}${window.location.search}${buildViewHash(view)}`;
  try {
    window.history.replaceState(window.history.state, "", target);
  } catch {
    /* swallow — FSM state stays authoritative */
  }
}
