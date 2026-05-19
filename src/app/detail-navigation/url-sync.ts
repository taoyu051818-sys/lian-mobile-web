/**
 * Bridges window.location.hash → reducer for the post-detail tid.
 *
 * The detail-navigation reducer is the single source of truth for "is a detail
 * open, and which one." This module is the only place that listens to
 * hashchange / popstate for the post-detail hash. The view-hash side has its
 * own listener in `src/app/view-hash.ts`; the two are intentionally
 * independent so opening or closing a detail does not move the active view.
 *
 * Why both hashchange and popstate: in-app pushState updates fire popstate
 * but not hashchange in some browsers; manual URL edits and bf-cache restores
 * fire hashchange but may not always fire popstate. Listening to both is the
 * portable subset.
 */

import { parseDeepLink } from "../deepLink";
import { dispatch } from "./store";

function readTidFromWindow(): number | null {
  if (typeof window === "undefined") return null;
  const link = parseDeepLink(window.location.hash || "");
  if (!link || link.view !== "post-detail") return null;
  return link.tid;
}

function syncFromWindow(): void {
  dispatch({ type: "url-sync", tid: readTidFromWindow() });
}

let installed = false;

/**
 * Idempotent install — safe to call multiple times. Test entrypoints can call
 * this after stubbing window.location to set up the initial state.
 */
export function installUrlSync(): void {
  if (installed) return;
  installed = true;
  if (typeof window === "undefined") return;
  syncFromWindow();
  window.addEventListener("hashchange", syncFromWindow);
  window.addEventListener("popstate", () => {
    // popstate's URL is already updated by the time we run. If the new URL has
    // no detail tid, this maps to a close — but the close should not turn around
    // and write history again (the browser already did that for us).
    const tid = readTidFromWindow();
    if (tid === null) {
      dispatch({ type: "close", source: "popstate" });
      return;
    }
    dispatch({ type: "url-sync", tid });
  });
}

if (typeof window !== "undefined") {
  installUrlSync();
}
