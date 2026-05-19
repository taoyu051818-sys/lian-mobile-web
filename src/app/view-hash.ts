/**
 * View-hash singleton — `#/feed`, `#/map`, `#/publish`, `#/messages`,
 * `#/profile` (and the secret `#/admin`, `#/verification`).
 *
 * The URL hash has exactly one value at a time, so `useActiveView` and the
 * bottom tab bar must observe the same ref. Listener is attached eagerly at
 * module load — `useActiveView` runs during `App.vue`'s setup (before any
 * onMounted), so the initial hash must be visible from the very first render.
 *
 * Post-detail hashes (`#/post/{tid}`) are intentionally NOT handled here —
 * the detail-navigation FSM owns its own hash listener in
 * `detail-navigation/url-sync.ts`. This module keeps `viewFromHash` at its
 * current value when a post-detail hash is in effect, so closing the detail
 * doesn't snap the user back to feed.
 */

import { ref } from "vue";
import { buildViewHash, parseDeepLink } from "./deepLink";
import type { AppViewKey } from "./view-types";

const viewFromHash = ref<AppViewKey>("feed");

function readHashFromWindow(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash || "";
}

function syncFromWindow() {
  const link = parseDeepLink(readHashFromWindow());
  if (!link) return;
  if (link.view === "post-detail") return;
  viewFromHash.value = link.view;
}

if (typeof window !== "undefined") {
  syncFromWindow();
  window.addEventListener("hashchange", syncFromWindow);
  window.addEventListener("popstate", syncFromWindow);
}

/**
 * Push `#/{view}` onto history (or replace, when `replace` is set). Used by
 * `useActiveView.setActiveView` so the bottom-tab bar drives the URL.
 *
 * Pushing a view hash from inside a `#/post/{tid}` URL is the user-initiated
 * "switch tab while detail is open" path: the new hash replaces the post hash,
 * which causes the detail-navigation url-sync to dispatch `close` so the
 * App-level DetailSurface unmounts.
 */
export function pushViewHash(view: AppViewKey, options: { replace?: boolean } = {}) {
  viewFromHash.value = view;
  if (typeof window === "undefined") return;
  const target = `${window.location.pathname}${window.location.search}${buildViewHash(view)}`;
  // history.pushState/replaceState can throw in sandboxed iframes or when the
  // page exceeds the per-document history quota. The SPA still needs to advance
  // its in-memory routing state — the URL bar will be out of sync until the
  // next successful navigation.
  try {
    if (options.replace) {
      window.history.replaceState(window.history.state, "", target);
    } else {
      window.history.pushState(window.history.state, "", target);
    }
  } catch {
    /* swallow — SPA state above stays authoritative */
  }
}

/** Test/SSR-friendly accessor for the view-hash singleton ref. */
export function getViewFromHashRef() {
  return viewFromHash;
}
