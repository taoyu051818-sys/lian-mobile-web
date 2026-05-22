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
 * Cold-start history bootstrap.
 *
 * When the SPA loads directly at `#/post/{tid}` (deep-link, share-link,
 * refresh-on-detail, etc.) the browser has exactly one history entry — the
 * post URL itself. `history.back()` from inside the SPA then has no SPA entry
 * to walk to: it either no-ops or leaves the page entirely, and the App-level
 * DetailSurface stays stuck on screen.
 *
 * The fix synthesizes a `#/feed` entry beneath the post entry: replaceState
 * to `#/feed`, then pushState back to the post hash. After this the
 * detail-navigation FSM still observes the post hash on first paint, but a
 * subsequent `history.back()` resolves to `#/feed` — popstate fires,
 * url-sync dispatches `close`, and the underlying FeedView (already mounted
 * because viewFromHash defaults to "feed") becomes visible.
 *
 * Idempotent: only runs the first time the module loads. Because the install
 * point (url-sync) runs at app boot BEFORE any in-app pushState can fire,
 * observing a post-detail hash here is by definition a cold-start path — no
 * extra `history.length` heuristic is needed.
 *
 * Cold-start contract trip wire: tests/e2e/post-detail-cold-start.spec.ts
 * (`deep-link cold start renders detail and underlying tab is feed`).
 */
let coldStartBootstrapped = false;

export function bootstrapColdStartHistory(): void {
  if (coldStartBootstrapped) return;
  coldStartBootstrapped = true;
  if (typeof window === "undefined") return;
  const link = parseDeepLink(readHashFromWindow());
  if (!link || link.view !== "post-detail") return;
  const base = `${window.location.pathname}${window.location.search}`;
  try {
    window.history.replaceState(window.history.state, "", `${base}${buildViewHash("feed")}`);
    window.history.pushState(window.history.state, "", `${base}${buildPostDetailHash(link.tid)}`);
  } catch {
    /* swallow — FSM stays authoritative */
  }
}

/** Test-only reset for the bootstrap one-shot guard. */
export function __resetColdStartBootstrapForTesting(): void {
  coldStartBootstrapped = false;
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
