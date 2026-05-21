/**
 * Read-side composable for the errand order timeline view (issue #647).
 *
 * Wraps `GET /api/errands/orders/:id`. The state machine itself is owned by
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
import { computed, ref } from "vue";
import { cancelErrandOrder, fetchErrandOrder } from "../../api/errands";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { ERRAND_ORDER_DETAIL_LOAD_ERROR, ORDERS_CANCEL_FAILED } from "../../config/brand";
import type { ErrandOrderDetail } from "../../types/errand";
import { isTerminalErrandStatus } from "./errand-format";

const POLL_INTERVAL_MS = 12_000;

export function useErrandOrderDetail() {
  const detail = ref<ErrandOrderDetail | null>(null);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref("");
  const cancelling = ref(false);
  const cancelError = ref("");

  /**
   * Cancel CTA is only meaningful while the order is still in flight.
   * Anything in `TERMINAL_ERRAND_STATUSES` (delivered / cancelled / refunded)
   * is final and the button must not render. We intentionally do NOT block
   * `disputed` here even though it's mid-flow — disputes can resolve back
   * to delivered or refunded, and the requester can still walk away from
   * one if no runner has been assigned yet.
   */
  const canCancel = computed(() => {
    const status = detail.value?.order.status;
    return Boolean(status && !isTerminalErrandStatus(status) && !cancelling.value);
  });

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

  /**
   * Cancel the current order. Only callable while `canCancel` is true; the
   * timeline view also gates the CTA, so this is belt-and-suspenders. On
   * success the freshly-fetched detail (with the cancelled status + final
   * timeline entry) replaces `detail` and we stop polling — there's nothing
   * left to poll for once the order is terminal.
   *
   * Failure surfaces through `cancelError` instead of `errorMessage` so a
   * failed cancel does not blank out the timeline the user is looking at.
   */
  async function cancel(orderId: string) {
    if (!orderId || cancelling.value) return;
    cancelling.value = true;
    cancelError.value = "";
    try {
      const next = await cancelErrandOrder(orderId);
      if (next) {
        detail.value = next;
        loaded.value = true;
        // Cancellation is terminal; ticking again would just re-fetch the same
        // cancelled record. Stop the poll generation so an in-flight tick
        // doesn't overwrite the cancelled state.
        stop();
      } else {
        cancelError.value = ORDERS_CANCEL_FAILED;
      }
    } catch (error) {
      cancelError.value = extractErrorMessage(error, ORDERS_CANCEL_FAILED);
    } finally {
      cancelling.value = false;
    }
  }

  return {
    detail,
    loading,
    loaded,
    errorMessage,
    cancelling,
    cancelError,
    canCancel,
    refresh,
    start,
    stop,
    cancel,
  };
}
