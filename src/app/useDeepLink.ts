import { ref } from "vue";
import { buildPostDetailHash, parseDeepLink } from "./deepLink";

/**
 * Module-scoped singleton — `window.location.hash` has exactly one value at a
 * time, so multiple consumers (App, FeedView, etc.) must observe the same
 * `detailTid` ref.
 *
 * Eager initial read at module load is intentional: `useActiveView` runs
 * during App.vue's setup (before any onMounted), and it must see the deep
 * link tid so the feed tab is selected from the very first render.
 */
const detailTid = ref<number | null>(null);

function readHashFromWindow(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash || "";
}

function syncFromWindow() {
  const link = parseDeepLink(readHashFromWindow());
  detailTid.value = link?.tid ?? null;
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
  try {
    if (options.replace) {
      window.history.replaceState(window.history.state, "", target);
    } else {
      window.history.pushState(window.history.state, "", target);
    }
  } finally {
    detailTid.value = tid;
  }
}

/**
 * Strip `#/post/{tid}` from the URL when the detail panel closes from inside
 * the SPA. replaceState is intentional — using `history.back()` would unwind
 * any other entries the user navigated through (tab switches, etc.).
 */
export function clearPostDetailHash() {
  if (typeof window === "undefined") return;
  const link = parseDeepLink(readHashFromWindow());
  if (!link) {
    detailTid.value = null;
    return;
  }
  const target = `${window.location.pathname}${window.location.search}`;
  try {
    window.history.replaceState(window.history.state, "", target);
  } finally {
    detailTid.value = null;
  }
}

/**
 * Component-side accessor — returns the singleton tid ref plus the
 * push/clear helpers. No lifecycle hooks needed; listeners are attached
 * eagerly at module load.
 */
export function useDeepLink() {
  return {
    detailTid,
    pushPostDetailHash,
    clearPostDetailHash,
  };
}

/** Test/SSR-friendly accessor for the singleton ref. */
export function getDetailTidRef() {
  return detailTid;
}
