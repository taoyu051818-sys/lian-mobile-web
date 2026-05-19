/**
 * Read-side composable for the errand order timeline view (issue #647).
 *
 * Wraps `GET /api/errand-orders/:id`. The state machine itself is owned by
 * #648, so this composable does not drive transitions — but the user-facing
 * timeline still needs to *see* transitions land, so we layer two things on
 * top of the basic fetch:
 *
 * 1. A manual `refresh(orderId)` the view binds to a refresh button.
 * 2. Lightweight polling for non-terminal statuses. Once the order reaches
 *    a terminal state (delivered / cancelled / refunded), polling stops on
 *    its own. Caller is responsible for invoking `start(orderId)` /
 *    `stop()` from the view's lifecycle hooks so we never leak a timer.
 */
import { ref } from "vue";
import { fetchErrandOrder } from "../../api/errands";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { ERRAND_ORDER_DETAIL_LOAD_ERROR } from "../../config/brand";
import type { ErrandOrderDetail } from "../../types/errand";
import { isTerminalErrandStatus } from "./errand-format";

const POLL_INTERVAL_MS = 12_000;

export function useErrandOrderDetail() {
  const detail = ref<ErrandOrderDetail | null>(null);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref("");

  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollOrderId = "";
  let pollGeneration = 0;

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function refresh(orderId: string) {
    if (!orderId) {
      detail.value = null;
      return;
    }
    loading.value = true;
    errorMessage.value = "";
    try {
      const next = await fetchErrandOrder(orderId);
      // `fetchErrandOrder` returns null when the wire shape couldn't be
      // normalized (e.g. backend dropped a required field). Without an
      // explicit error here the timeline view would render an empty
      // <template> with no message — surface it as a load failure so the
      // user gets the same retry affordance as a network error.
      if (!next) {
        detail.value = null;
        errorMessage.value = ERRAND_ORDER_DETAIL_LOAD_ERROR;
        return;
      }
      detail.value = next;
      loaded.value = true;
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, ERRAND_ORDER_DETAIL_LOAD_ERROR);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Begin polling the given orderId. Re-entrant: calling start twice in a row
   * with the same orderId is a no-op past the initial fetch; calling with a
   * different orderId restarts. Polling auto-stops when the latest detail
   * reaches a terminal status — callers don't need to inspect status
   * themselves.
   */
  function start(orderId: string) {
    if (!orderId) return;
    if (pollOrderId === orderId && pollTimer !== null) return;
    stop();
    pollOrderId = orderId;
    const generation = ++pollGeneration;

    const tick = async () => {
      if (generation !== pollGeneration) return;
      try {
        const next = await fetchErrandOrder(orderId);
        if (generation !== pollGeneration) return;
        if (next) {
          // Polling refreshes are silent on the error channel: a transient
          // 5xx mid-poll shouldn't replace a successful timeline with an
          // error banner. The next tick will pick the data back up.
          detail.value = next;
          loaded.value = true;
          errorMessage.value = "";
        }
        if (!next || isTerminalErrandStatus(next.order.status)) {
          clearPollTimer();
          return;
        }
      } catch {
        // Same rationale as above — drop the error and let the next tick
        // try again. The user's manual refresh button is the surface for
        // genuine "load failed" affordance.
      }
      if (generation !== pollGeneration) return;
      pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void refresh(orderId).then(() => {
      if (generation !== pollGeneration) return;
      const status = detail.value?.order.status;
      if (status && isTerminalErrandStatus(status)) return;
      pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
    });
  }

  function stop() {
    pollGeneration++;
    pollOrderId = "";
    clearPollTimer();
  }

  return {
    detail,
    loading,
    loaded,
    errorMessage,
    refresh,
    start,
    stop,
  };
}
