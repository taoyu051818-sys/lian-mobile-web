import { ref } from "vue";
import { buildPostDetailHash, buildViewHash, parseDeepLink } from "./deepLink";
import type { AppViewKey } from "./view-types";

/**
 * Module-scoped singletons — `window.location.hash` has exactly one value at a
 * time, so multiple consumers (App, FeedView, useActiveView, etc.) must
 * observe the same refs.
 *
 * Eager initial read at module load is intentional: `useActiveView` runs
 * during App.vue's setup (before any onMounted), and it must see the deep
 * link tid / view from the very first render.
 */
const detailTid = ref<number | null>(null);
const viewFromHash = ref<AppViewKey>("feed");

function readHashFromWindow(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash || "";
}

function syncFromWindow() {
  const link = parseDeepLink(readHashFromWindow());
  if (link && link.view === "post-detail") {
    detailTid.value = link.tid;
    return;
  }
  detailTid.value = null;
  if (link) {
    viewFromHash.value = link.view;
  }
  // No recognized hash → leave viewFromHash at its current value (default "feed"
  // on first load, or whatever the user last navigated to). This keeps a stray
  // hashchange to "" from snapping the user back to feed unexpectedly.
}

if (typeof window !== "undefined") {
  syncFromWindow();
  window.addEventListener("hashchange", syncFromWindow);
  window.addEventListener("popstate", syncFromWindow);
}

/**
 * Push `#/post/{tid}` onto history (or replace, when `replace` is set).
 *
 * Used by FeedView when the user opens a card so the URL reflects the visible
 * detail view, and so the back button closes the detail (popstate re-syncs
 * `detailTid` from the new hash).
 */
export function pushPostDetailHash(tid: number, options: { replace?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const target = `${window.location.pathname}${window.location.search}${buildPostDetailHash(tid)}`;
  // history.pushState/replaceState can throw in sandboxed iframes or when the
  // page exceeds the per-document history quota. The SPA still needs to advance
  // its in-memory routing state in those cases — the URL bar will simply be
  // out of sync until the next successful navigation.
  try {
    if (options.replace) {
      window.history.replaceState(window.history.state, "", target);
    } else {
      window.history.pushState(window.history.state, "", target);
    }
  } catch {
    /* swallow — SPA state below stays authoritative */
  }
  detailTid.value = tid;
}

/**
 * Strip `#/post/{tid}` from the URL when the detail panel closes from inside
 * the SPA. replaceState is intentional — using `history.back()` would unwind
 * any other entries the user navigated through (tab switches, etc.).
 *
 * If a view tab is currently selected, the URL is replaced with `#/{view}` so
 * the address bar stays consistent with the visible tab.
 */
export function clearPostDetailHash() {
  if (typeof window === "undefined") return;
  const link = parseDeepLink(readHashFromWindow());
  if (!link || link.view !== "post-detail") {
    detailTid.value = null;
    return;
  }
  const target = `${window.location.pathname}${window.location.search}${buildViewHash(viewFromHash.value)}`;
  // See note in pushPostDetailHash — history can throw, SPA state still advances.
  try {
    window.history.replaceState(window.history.state, "", target);
  } catch {
    /* swallow — SPA state below stays authoritative */
  }
  detailTid.value = null;
}

/**
 * Push `#/{view}` onto history (or replace, when `replace` is set). Used by
 * `useActiveView.setActiveView` so the bottom-tab bar drives the URL.
 *
 * Pushing a view hash from inside a `#/post/{tid}` URL is the user-initiated
 * "switch tab while detail is open" path: the new hash replaces the post hash,
 * which causes `syncFromWindow` to clear `detailTid` so FeedView's
 * detail-panel watch closes the panel.
 */
export function pushViewHash(view: AppViewKey, options: { replace?: boolean } = {}) {
  viewFromHash.value = view;
  detailTid.value = null;
  if (typeof window === "undefined") return;
  const target = `${window.location.pathname}${window.location.search}${buildViewHash(view)}`;
  if (options.replace) {
    window.history.replaceState(window.history.state, "", target);
  } else {
    window.history.pushState(window.history.state, "", target);
  }
}

/**
 * Component-side accessor — returns the singleton refs plus the push/clear
 * helpers. No lifecycle hooks needed; listeners are attached eagerly at module
 * load.
 */
export function useDeepLink() {
  return {
    detailTid,
    viewFromHash,
    pushPostDetailHash,
    clearPostDetailHash,
    pushViewHash,
  };
}

/** Test/SSR-friendly accessor for the detail-tid singleton ref. */
export function getDetailTidRef() {
  return detailTid;
}

/** Test/SSR-friendly accessor for the view-hash singleton ref. */
export function getViewFromHashRef() {
  return viewFromHash;
}
