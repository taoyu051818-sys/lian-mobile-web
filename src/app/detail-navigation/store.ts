/**
 * Module-scoped reactive wrapper around the pure detail-navigation reducer.
 *
 * Why a module singleton: the URL hash, the shell chrome slot, the panel mount
 * inside FeedView, and the tab-routing in `useActiveView` all need to agree on
 * "which tid (if any) is currently being shown." Anything less than a singleton
 * either duplicates state (the bug we are fixing) or makes consumers know about
 * each other.
 *
 * Component-side, callers go through `useDetailNavigation()` which exposes
 * computed views and three command verbs (open/close/retry). All other state
 * mutations are internal.
 */

import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import type { PostDetail } from "../../types/post";
import {
  initialState,
  reduce,
  select,
  type CloseSource,
  type DetailAction,
  type DetailState,
  type OpenSource,
  type SideEffect,
} from "./state";
import { fetchDetailWithToken } from "./fetcher";
import { clearPostDetailHash, pushPostDetailHash } from "../post-detail-hash";
import { useShellChrome } from "../../shell/useShellChrome";

const stateRef = ref<DetailState>(initialState());

type EffectHandler = (effect: SideEffect) => void;

const defaultEffectHandlers: Record<SideEffect["kind"], EffectHandler> = {
  fetch: (effect) => {
    if (effect.kind !== "fetch") return;
    void fetchDetailWithToken(effect.tid, effect.token, dispatch);
  },
  "history-push": (effect) => {
    if (effect.kind !== "history-push") return;
    pushPostDetailHash(effect.tid);
  },
  "history-clear": () => {
    clearPostDetailHash();
  },
};

let effectHandlers: Record<SideEffect["kind"], EffectHandler> = defaultEffectHandlers;

/**
 * Tests can swap the handlers to assert effect emission without touching
 * window.history or the network. Production never calls this.
 */
export function __setEffectHandlersForTesting(
  handlers: Partial<Record<SideEffect["kind"], EffectHandler>>,
): () => void {
  const prior = effectHandlers;
  effectHandlers = { ...defaultEffectHandlers, ...handlers };
  return () => {
    effectHandlers = prior;
  };
}

/**
 * Reset to a clean closed state — only intended for tests so the module
 * singleton can be reused across cases without bleed-through. Calls in app
 * code should go through close() instead.
 */
export function __resetStoreForTesting(): void {
  stateRef.value = initialState();
}

export function dispatch(action: DetailAction): void {
  const result = reduce(stateRef.value, action);
  stateRef.value = result.state;
  for (const effect of result.effects) {
    effectHandlers[effect.kind](effect);
  }
}

const detailOpen = computed(() => select.isOpen(stateRef.value));
const detailTid = computed(() => select.tid(stateRef.value));
const detailLoading = computed(() => select.loading(stateRef.value));
const detailError = computed(() => select.error(stateRef.value));
const detailPost = computed(() => select.post(stateRef.value));

/**
 * Chrome slot is a derived view of the FSM, not an independently mutated piece
 * of state. Whenever the FSM is open, the shell renders the detail-topbar (top)
 * and reply-dock (bottom); when closed, the bottom region falls back to the
 * tab bar and the top region clears. This single watcher replaces the old
 * `pushSlot` stack and `detailChromeLockCount` defenses (#615) — page chrome
 * cannot collide with this because `applyPageChrome` no longer touches `slot`.
 */
const chromeBound = { installed: false };

function bindChromeToState(): void {
  if (chromeBound.installed) return;
  chromeBound.installed = true;
  const chrome = useShellChrome();
  watch(
    detailOpen,
    (open) => {
      if (open) {
        chrome.setSlot("top", "detail-topbar");
        chrome.setSlot("bottom", "reply-dock");
      } else {
        chrome.setSlot("top", null);
        chrome.setSlot("bottom", "tabs");
      }
    },
    { immediate: true },
  );
}

bindChromeToState();

export interface DetailNavigation {
  state: Readonly<Ref<DetailState>>;
  detailOpen: ComputedRef<boolean>;
  detailTid: ComputedRef<number | null>;
  detailLoading: ComputedRef<boolean>;
  detailError: ComputedRef<string>;
  detailPost: ComputedRef<PostDetail | null>;
  open(tid: number, source?: OpenSource): void;
  close(source?: CloseSource): void;
  retry(): void;
}

export function useDetailNavigation(): DetailNavigation {
  return {
    state: stateRef,
    detailOpen,
    detailTid,
    detailLoading,
    detailError,
    detailPost,
    open(tid, source = "card") {
      dispatch({ type: "open", tid, source });
    },
    close(source = "user-tap") {
      dispatch({ type: "close", source });
    },
    retry() {
      const tid = select.tid(stateRef.value);
      if (tid == null) return;
      dispatch({ type: "open", tid, source: "retry" });
    },
  };
}

/** Read-only accessor for tests / advanced consumers. */
export function getDetailStateRef(): Readonly<Ref<DetailState>> {
  return stateRef;
}
