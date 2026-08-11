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

import { computed, ref, toRaw, watch, type ComputedRef, type Ref } from "vue";
import type { PostDetail } from "../../types/post";
import { postReactionSettlements, type PostReactionSettlement } from "../../features/reactions";
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
import { registerBeforeNavigate } from "../view-hash";

const stateRef = ref<DetailState>(initialState());

interface DetailLoadingOwner {
  tid: number;
  token: number;
  controller: AbortController;
}

interface DetailReadyProjectionOwner {
  tid: number;
  rawPost: PostDetail;
  likeSequenceFloor: number;
  saveSequenceFloor: number;
}

let loadingOwner: DetailLoadingOwner | null = null;
let readyProjectionOwner: DetailReadyProjectionOwner | null = null;

function releaseLoadingOwner(): void {
  const owner = loadingOwner;
  if (!owner) return;
  loadingOwner = null;
  owner.controller.abort();
}

function releaseLoadingOwnerForState(nextState: DetailState): void {
  const owner = loadingOwner;
  if (
    owner &&
    nextState.kind === "loading" &&
    nextState.token === owner.token &&
    Object.is(nextState.tid, owner.tid)
  ) {
    return;
  }
  releaseLoadingOwner();
}

function reconcileReadyProjectionOwner(nextState: DetailState): void {
  if (nextState.kind !== "ready") {
    readyProjectionOwner = null;
    return;
  }

  const rawPost = toRaw(nextState.post);
  if (
    readyProjectionOwner &&
    readyProjectionOwner.rawPost === rawPost &&
    Object.is(readyProjectionOwner.tid, nextState.tid)
  ) {
    return;
  }

  const sequenceFloor = postReactionSettlements.currentSequence();
  readyProjectionOwner = {
    tid: nextState.tid,
    rawPost,
    likeSequenceFloor: sequenceFloor,
    saveSequenceFloor: sequenceFloor,
  };
}

function applyReadySettlement(event: PostReactionSettlement): void {
  const state = stateRef.value;
  const owner = readyProjectionOwner;
  if (state.kind !== "ready" || !owner) return;

  const rawPost = toRaw(state.post);
  if (owner.rawPost !== rawPost) return;
  if (!Number.isInteger(event.tid) || event.tid <= 0) return;
  if (
    !Object.is(event.tid, owner.tid) ||
    !Object.is(event.tid, state.tid) ||
    !Object.is(event.tid, state.post.tid)
  ) {
    return;
  }

  if (event.kind === "like") {
    if (event.sequence <= owner.likeSequenceFloor) return;
    owner.likeSequenceFloor = event.sequence;
    state.post.liked = event.liked;
    state.post.likeCount = event.likeCount;
    return;
  }

  if (event.kind === "save") {
    if (event.sequence <= owner.saveSequenceFloor) return;
    owner.saveSequenceFloor = event.sequence;
    state.post.bookmarked = event.bookmarked;
  }
}

postReactionSettlements.subscribe(applyReadySettlement);

type EffectHandler = (effect: SideEffect) => void;

function runFetchEffect(effect: Extract<SideEffect, { kind: "fetch" }>): void {
  const state = stateRef.value;
  if (
    state.kind !== "loading" ||
    state.token !== effect.token ||
    !Object.is(state.tid, effect.tid)
  ) {
    return;
  }

  const controller = new AbortController();
  const owner: DetailLoadingOwner = {
    tid: effect.tid,
    token: effect.token,
    controller,
  };
  loadingOwner = owner;

  const clearOwner = (): void => {
    if (loadingOwner === owner) loadingOwner = null;
  };
  void fetchDetailWithToken(effect.tid, effect.token, dispatch, {
    signal: owner.controller.signal,
  }).then(clearOwner, clearOwner);
}

const defaultEffectHandlers: Record<SideEffect["kind"], EffectHandler> = {
  fetch: (effect) => {
    if (effect.kind !== "fetch") return;
    runFetchEffect(effect);
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
  releaseLoadingOwner();
  readyProjectionOwner = null;
  stateRef.value = initialState();
}

export function dispatch(action: DetailAction): void {
  const result = reduce(stateRef.value, action);
  const nextState = result.state;
  releaseLoadingOwnerForState(nextState);
  reconcileReadyProjectionOwner(nextState);
  stateRef.value = nextState;
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
 * Top chrome slot is a derived view of the FSM. While detail is open, the
 * top region renders the detail-topbar; when closed, the top region clears
 * and the page's own chrome (e.g. feed tabs) takes over.
 *
 * The BOTTOM slot is intentionally NOT FSM-driven — that was the #636
 * cold-start regression: flipping bottom to "reply-dock" unmounted the
 * BottomTabBar and broke the contract that the App-level DetailSurface
 * overlay must not displace the underlying tab bar. The reply dock now
 * renders inside the DetailSurface (#lian-detail-surface-dock-slot), so
 * the bottom region stays in its default `tabs` slot owned by AppShell.
 *
 * This single watcher still replaces the old `pushSlot` stack and
 * `detailChromeLockCount` defenses (#615) — page chrome cannot collide
 * with this because `applyPageChrome` no longer touches `slot`.
 */
const chromeBound = { installed: false };

function bindChromeToState(): void {
  if (chromeBound.installed) return;
  chromeBound.installed = true;
  const chrome = useShellChrome();
  watch(
    detailOpen,
    (open) => {
      chrome.setSlot("top", open ? "detail-topbar" : null);
      // Bottom slot is owned by AppShell (ensureBottomSlot('tabs')); the
      // FSM must not write here or the tab bar will unmount under the
      // App-level DetailSurface. See cold-start contract in #636.
    },
    { immediate: true },
  );
}

bindChromeToState();

/**
 * Auto-close the detail overlay when in-app navigation runs while the FSM is
 * open (mw#827 PR-4 — detail overlay exit contract).
 *
 * Before this hook landed, callers like `PostDetailMerchantBlock` had to
 * manually `detail.close('view-change')` BEFORE `setActiveView(...)` or the
 * App-level `DetailSurface` would stay mounted on top of the next view.
 * Other CTAs that forgot the dance produced the user-visible bug: 帮我取 /
 * 报名 / 交易 navigations from a detail surface left a ghost overlay over
 * the next route, and浏览器 back / UI 返回 disagreed.
 *
 * The fix: the only in-app navigation entry point (`pushViewHash`) fires
 * registered before-navigate hooks BEFORE mutating its own ref. We dispatch
 * `close('view-change')` here, which:
 *   1. flips the FSM to `closed` (DetailSurface unmounts via its v-if), and
 *   2. emits a `history-clear` effect — `clearPostDetailHash` reads the
 *      OLD `viewFromHash` value and `replaceState`s it over `#/post/{tid}`,
 *      so the dead detail entry is gone before the new view's pushState
 *      lands on top.
 *
 * Browser back is unaffected: it routes through the existing popstate
 * listener in `url-sync.ts`, which dispatches `close('popstate')` and
 * skips the history-clear effect (the browser already popped).
 *
 * Hook is registered eagerly at module load — by the time any user action
 * fires, the store has been imported (everyone goes through
 * `useDetailNavigation`) so the contract is in place.
 */
const navigateBound = { installed: false };

function bindNavigateAwayClose(): void {
  if (navigateBound.installed) return;
  navigateBound.installed = true;
  registerBeforeNavigate(() => {
    if (!select.isOpen(stateRef.value)) return;
    dispatch({ type: "close", source: "view-change" });
  });
}

bindNavigateAwayClose();

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
