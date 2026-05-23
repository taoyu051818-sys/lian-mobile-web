/**
 * Errand order share card composable (mw#892 / ps#552).
 *
 * Owns the load + retry lifecycle for the errand order share card so the
 * ErrandOrderTimelineView stays presentational and the view->composable->api
 * boundary check keeps passing.
 *
 * Lifecycle:
 *   - `start(orderId)` opens the preview and triggers a fetch.
 *   - `retry()` re-fetches the same orderId after a network error.
 *   - `close()` resets the sheet state.
 *
 * Error model mapped from `ErrandOrderShareCardError.reason`:
 *   - `not-found` -> order not shareable (terminal status or doesn't exist).
 *   - `network`   -> transient failure, surface a retry affordance.
 */

import { computed, ref } from "vue";
import {
  fetchErrandOrderShareCard,
  ErrandOrderShareCardError,
  type ErrandOrderShareCard,
} from "../../api/errands";
import { SHARE_CARD_ERROR_NETWORK, SHARE_CARD_ERROR_NOT_FOUND } from "../../config/brand";

export type { ErrandOrderShareCard } from "../../api/errands";

export type ErrandOrderShareCardStatus = "idle" | "loading" | "ready" | "error";

interface UseErrandOrderShareCardOptions {
  /** Injected for unit tests; defaults to the real API client. */
  loader?: (orderId: string) => Promise<ErrandOrderShareCard>;
}

export function useErrandOrderShareCard(options: UseErrandOrderShareCardOptions = {}) {
  const loader = options.loader ?? fetchErrandOrderShareCard;

  const open = ref(false);
  const status = ref<ErrandOrderShareCardStatus>("idle");
  const card = ref<ErrandOrderShareCard | null>(null);
  const errorReason = ref<"not-found" | "network" | "">("");
  const errorMessage = ref("");
  const currentOrderId = ref<string | null>(null);
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

  async function load(orderId: string) {
    const token = ++requestToken;
    status.value = "loading";
    card.value = null;
    errorReason.value = "";
    errorMessage.value = "";

    try {
      const result = await loader(orderId);
      if (token !== requestToken) return;
      card.value = result;
      status.value = "ready";
    } catch (err) {
      if (token !== requestToken) return;
      if (err instanceof ErrandOrderShareCardError) {
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

  function start(orderId: string) {
    currentOrderId.value = orderId;
    open.value = true;
    void load(orderId);
  }

  function close() {
    open.value = false;
    currentOrderId.value = null;
    requestToken++; // invalidate any in-flight response
    reset();
  }

  function retry() {
    const orderId = currentOrderId.value;
    if (orderId == null) return;
    void load(orderId);
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
