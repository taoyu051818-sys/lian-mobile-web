/**
 * Share-card preview composable (ps#484 V1 envelope consumer).
 *
 * Owns the load + retry lifecycle for the V1 share-card envelope so the
 * PostDetailPanel view stays presentational and the view→composable→api
 * boundary check (`scripts/check-view-imports-composable.mjs`) keeps passing.
 *
 * Lifecycle:
 *   - `open(tid)` opens the preview and triggers a fetch.
 *   - `retry()` re-fetches the same tid after a network error.
 *   - `close()` resets the sheet state.
 *
 * Three-state error model mapped from `ShareCardError.reason`:
 *   - `not-found` → `SHARE_CARD_ERROR_NOT_FOUND` ("内容已删除或不存在").
 *     The backend collapses 404 + audience-rejected so the existence of
 *     a private post does not leak.
 *   - `network`   → `SHARE_CARD_ERROR_NETWORK`. Surface a retry affordance.
 *
 * Stale-response guard: every fetch increments a request token; only the
 * latest token's response is allowed to mutate state. This prevents
 * `open(A) → open(B)` races from leaving stale data in the sheet.
 */

import { computed, ref } from "vue";
import { fetchShareCard, ShareCardError, type ShareCard } from "../../api/share-card";
import { SHARE_CARD_ERROR_NETWORK, SHARE_CARD_ERROR_NOT_FOUND } from "../../config/brand";
import type { FeedItemId } from "../../types/feed";

export type ShareCardPreviewStatus = "idle" | "loading" | "ready" | "error";

export interface ShareCardPreviewState {
  open: boolean;
  status: ShareCardPreviewStatus;
  card: ShareCard | null;
  errorReason: "not-found" | "network" | "";
  errorMessage: string;
}

interface UseShareCardPreviewOptions {
  /** Injected for unit tests; defaults to the real API client. */
  loader?: (tid: FeedItemId) => Promise<ShareCard>;
}

export function useShareCardPreview(options: UseShareCardPreviewOptions = {}) {
  const loader = options.loader ?? fetchShareCard;

  const open = ref(false);
  const status = ref<ShareCardPreviewStatus>("idle");
  const card = ref<ShareCard | null>(null);
  const errorReason = ref<"not-found" | "network" | "">("");
  const errorMessage = ref("");
  const currentTid = ref<FeedItemId | null>(null);
  let requestToken = 0;

  const isOpen = computed(() => open.value);
  const isLoading = computed(() => status.value === "loading");
  const isReady = computed(() => status.value === "ready");
  const isError = computed(() => status.value === "error");
  const canRetry = computed(() => status.value === "error" && errorReason.value === "network");

  function reset() {
    status.value = "idle";
    card.value = null;
    errorReason.value = "";
    errorMessage.value = "";
  }

  async function load(tid: FeedItemId) {
    const token = ++requestToken;
    status.value = "loading";
    card.value = null;
    errorReason.value = "";
    errorMessage.value = "";

    try {
      const result = await loader(tid);
      if (token !== requestToken) return;
      card.value = result;
      status.value = "ready";
    } catch (err) {
      if (token !== requestToken) return;
      if (err instanceof ShareCardError) {
        errorReason.value = err.reason;
        errorMessage.value =
          err.reason === "not-found" ? SHARE_CARD_ERROR_NOT_FOUND : SHARE_CARD_ERROR_NETWORK;
      } else {
        errorReason.value = "network";
        errorMessage.value = SHARE_CARD_ERROR_NETWORK;
      }
      status.value = "error";
    }
  }

  function start(tid: FeedItemId) {
    currentTid.value = tid;
    open.value = true;
    void load(tid);
  }

  function close() {
    open.value = false;
    currentTid.value = null;
    requestToken++; // invalidate any in-flight response
    reset();
  }

  function retry() {
    const tid = currentTid.value;
    if (tid == null) return;
    void load(tid);
  }

  return {
    open: isOpen,
    status,
    card,
    errorReason,
    errorMessage,
    isLoading,
    isReady,
    isError,
    canRetry,
    start,
    close,
    retry,
  };
}
