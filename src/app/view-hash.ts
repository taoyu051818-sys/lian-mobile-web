/**
 * View-hash singleton.
 *
 *   visible tabs:  #/feed, #/map, #/publish, #/messages, #/profile
 *   secret views:  #/admin, #/verification, #/merchant, #/errand-order, #/runner
 *
 * Secret views are absent from the bottom tab bar (`appViews`) but a direct
 * hash or refresh must still mount the matching component, so this singleton
 * accepts every `AppViewKey` the parser recognises.
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
 * Before-navigate hook registry (mw#827 PR-4).
 *
 * In-app navigation goes through `pushViewHash`. Before this PR, that path
 * called `history.pushState` and mutated `viewFromHash.value` synchronously,
 * but neither operation fires `hashchange`, so the detail-navigation FSM's
 * url-sync listener had no chance to observe the navigation. The App-level
 * `DetailSurface` therefore stayed mounted painting on top of the next view.
 *
 * The hook fires with the OLD `viewFromHash` value still in place, which lets
 * the detail-navigation store dispatch `close('view-change')` and have its
 * `history-clear` effect `replaceState` the dead `#/post/{tid}` entry with
 * `#/{view-before-detail}`. The subsequent `pushState` here then layers
 * `#/{newview}` on top — back walks `[newview, view-before-detail]`, never
 * re-entering the dead detail entry.
 *
 * The hook surface is intentionally generic: anything that needs to react to
 * an in-app view change before the URL flips can subscribe. Today only the
 * detail-navigation store does, but the contract is reusable.
 */
type BeforeNavigateHook = (target: AppViewKey) => void;
const beforeNavigateHooks = new Set<BeforeNavigateHook>();

export function registerBeforeNavigate(hook: BeforeNavigateHook): () => void {
  beforeNavigateHooks.add(hook);
  return () => {
    beforeNavigateHooks.delete(hook);
  };
}

/** Test-only — drop every registered hook so module reloads don't bleed across cases. */
export function __resetBeforeNavigateHooksForTesting(): void {
  beforeNavigateHooks.clear();
}

/**
 * Push `#/{view}` onto history (or replace, when `replace` is set). Used by
 * `useActiveView.setActiveView` so the bottom-tab bar drives the URL.
 *
 * Pushing a view hash from inside a `#/post/{tid}` URL is the user-initiated
 * "switch tab while detail is open" path. Registered before-navigate hooks
 * fire BEFORE `viewFromHash` mutates and BEFORE `history.pushState`, so a
 * subscriber (the detail-navigation store) can clear an open overlay using
 * the still-current view as the replaceState fall-through.
 */
export function pushViewHash(view: AppViewKey, options: { replace?: boolean } = {}) {
  // Hooks observe the OLD viewFromHash AND the OLD history entry. The detail
  // FSM's close path uses both: history-clear replaceState writes #/{old-view}
  // over the dead post-detail entry while the URL is still `#/post/{tid}`.
  // A throwing hook must not block navigation — swallow per-hook so the SPA
  // never gets stuck on a half-applied URL.
  for (const hook of beforeNavigateHooks) {
    try {
      hook(view);
    } catch {
      /* swallow — navigation contract trumps hook robustness */
    }
  }
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
