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
 *    a terminal state (delivered / completed / cancelled / refunded), polling stops on
 *    its own. Caller is responsible for invoking `start(orderId)` /
 *    `stop()` from the view's lifecycle hooks so we never leak a timer.
 */
import { computed, ref, watch, type Ref } from "vue";
import { cancelErrandOrder, completeErrandOrder, fetchErrandOrder } from "../../api/errands";
import { fetchAuthMe } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  ERRAND_ORDER_COMPLETE_FAILED,
  ERRAND_ORDER_DETAIL_LOAD_ERROR,
  ORDERS_CANCEL_FAILED,
} from "../../config/brand";
import type { ErrandOrderDetail } from "../../types/errand";
import { isTerminalErrandStatus } from "./errand-format";

const POLL_INTERVAL_MS = 12_000;

export function useErrandOrderDetail(currentUserId?: Ref<string> | string) {
  const managesViewerIdentity = currentUserId === undefined;
  const detail = ref<ErrandOrderDetail | null>(null);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref("");
  const cancelling = ref(false);
  const cancelError = ref("");
  const completing = ref(false);
  const completeError = ref("");
  const managedCurrentUserId = ref("");

  const viewerUserId = computed(() => {
    if (managesViewerIdentity) return managedCurrentUserId.value.trim();
    return (typeof currentUserId === "string" ? currentUserId : currentUserId.value).trim();
  });

  let activeOrderId = "";
  let lifecycleGeneration = 0;
  let viewerLoadGeneration = 0;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollOrderId = "";
  let pollGeneration = 0;

  function resetActionState() {
    cancelling.value = false;
    cancelError.value = "";
    completing.value = false;
    completeError.value = "";
  }

  function clearPublicState() {
    detail.value = null;
    loading.value = false;
    loaded.value = false;
    errorMessage.value = "";
    resetActionState();
  }

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  /** Retire only the polling owner; keep a just-adopted terminal detail. */
  function stopPolling() {
    pollGeneration++;
    pollOrderId = "";
    clearPollTimer();
  }

  /**
   * A terminal write owns the newest server truth for this order. Retire all
   * read snapshots admitted before the write settled (including same-order
   * manual refreshes), but keep the terminal DTO itself visible.
   */
  function adoptTerminalDetail(next: ErrandOrderDetail) {
    detail.value = next;
    loading.value = false;
    loaded.value = true;
    errorMessage.value = "";
    resetActionState();
    lifecycleGeneration++;
    stopPolling();
  }

  function setActiveOrder(orderId: string) {
    if (activeOrderId === orderId) return;
    stopPolling();
    activeOrderId = orderId;
    lifecycleGeneration++;
    clearPublicState();
  }

  function snapshotOperation(orderId: string) {
    return {
      orderId,
      viewerUserId: viewerUserId.value,
      generation: lifecycleGeneration,
      managedViewerGeneration: viewerLoadGeneration,
    };
  }

  function isCurrentOperation(snapshot: ReturnType<typeof snapshotOperation>) {
    const viewerMatches =
      snapshot.viewerUserId === viewerUserId.value ||
      (managesViewerIdentity &&
        !snapshot.viewerUserId &&
        Boolean(viewerUserId.value) &&
        snapshot.managedViewerGeneration === viewerLoadGeneration);
    return (
      snapshot.orderId === activeOrderId &&
      viewerMatches &&
      snapshot.generation === lifecycleGeneration
    );
  }

  watch(
    viewerUserId,
    (nextViewerUserId, previousViewerUserId) => {
      if (managesViewerIdentity && !previousViewerUserId && nextViewerUserId) {
        resetActionState();
        return;
      }
      lifecycleGeneration++;
      activeOrderId = "";
      stopPolling();
      clearPublicState();
    },
    { flush: "sync" },
  );

  async function loadCurrentUserId() {
    if (!managesViewerIdentity) return;
    const generation = ++viewerLoadGeneration;
    try {
      const me = await fetchAuthMe();
      if (generation !== viewerLoadGeneration) return;
      managedCurrentUserId.value = typeof me?.id === "string" ? me.id.trim() : "";
    } catch {
      if (generation !== viewerLoadGeneration) return;
      managedCurrentUserId.value = "";
    }
  }

  function resetCurrentUserId() {
    if (!managesViewerIdentity) return;
    viewerLoadGeneration++;
    managedCurrentUserId.value = "";
    lifecycleGeneration++;
    activeOrderId = "";
    stopPolling();
    clearPublicState();
  }

  /**
   * Cancel CTA is only meaningful while the order is still in flight.
   * Anything in `TERMINAL_ERRAND_STATUSES` (delivered / completed / cancelled / refunded)
   * is final and the button must not render. We intentionally do NOT block
   * `disputed` here even though it's mid-flow — disputes can resolve back
   * to delivered or refunded, and the requester can still walk away from
   * one if no runner has been assigned yet.
   */
  const canCancel = computed(() => {
    const order = detail.value?.order;
    return Boolean(
      order &&
      order.orderId === activeOrderId &&
      !isTerminalErrandStatus(order.status) &&
      !cancelling.value,
    );
  });

  const canComplete = computed(() => {
    const order = detail.value?.order;
    if (!order || order.orderId !== activeOrderId || completing.value) return false;
    return order.status === "delivered" && order.requesterUserId === viewerUserId.value;
  });

  async function refresh(orderId: string) {
    if (!orderId) {
      stop();
      return;
    }
    setActiveOrder(orderId);
    const request = snapshotOperation(orderId);
    loading.value = true;
    errorMessage.value = "";
    try {
      const next = await fetchErrandOrder(orderId);
      if (!isCurrentOperation(request)) return;
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
      if (!isCurrentOperation(request)) return;
      errorMessage.value = extractErrorMessage(error, ERRAND_ORDER_DETAIL_LOAD_ERROR);
    } finally {
      if (isCurrentOperation(request)) loading.value = false;
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
    setActiveOrder(orderId);
    pollOrderId = orderId;
    const generation = ++pollGeneration;

    const tick = async () => {
      if (generation !== pollGeneration) return;
      const request = snapshotOperation(orderId);
      try {
        const next = await fetchErrandOrder(orderId);
        if (generation !== pollGeneration || !isCurrentOperation(request)) return;
        if (next) {
          // Polling refreshes are silent on the error channel: a transient
          // 5xx mid-poll shouldn't replace a successful timeline with an
          // error banner. The next tick will pick the data back up.
          detail.value = next;
          loaded.value = true;
          errorMessage.value = "";
        }
        if (!next || isTerminalErrandStatus(next.order.status)) {
          stopPolling();
          return;
        }
      } catch {
        if (generation !== pollGeneration || !isCurrentOperation(request)) return;
        // Same rationale as above — drop the error and let the next tick
        // try again. The user's manual refresh button is the surface for
        // genuine "load failed" affordance.
      }
      if (generation !== pollGeneration || !isCurrentOperation(request)) return;
      pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void refresh(orderId).then(() => {
      if (generation !== pollGeneration) return;
      const status = detail.value?.order.status;
      if (status && isTerminalErrandStatus(status)) {
        stopPolling();
        return;
      }
      pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
    });
  }

  function stop() {
    stopPolling();
    activeOrderId = "";
    lifecycleGeneration++;
    clearPublicState();
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
    if (
      !orderId ||
      orderId !== activeOrderId ||
      detail.value?.order.orderId !== orderId ||
      !canCancel.value
    ) {
      return;
    }
    const request = snapshotOperation(orderId);
    cancelling.value = true;
    cancelError.value = "";
    try {
      const next = await cancelErrandOrder(orderId);
      if (!isCurrentOperation(request)) return;
      if (next) {
        // Cancellation is terminal; ticking again would just re-fetch the same
        // cancelled record. Retire both poll and manual-read owners so neither
        // can overwrite the cancelled state after this write succeeds.
        adoptTerminalDetail(next);
      } else {
        cancelError.value = ORDERS_CANCEL_FAILED;
      }
    } catch (error) {
      if (!isCurrentOperation(request)) return;
      cancelError.value = extractErrorMessage(error, ORDERS_CANCEL_FAILED);
    } finally {
      if (isCurrentOperation(request)) cancelling.value = false;
    }
  }

  async function complete(orderId: string) {
    if (
      !orderId ||
      orderId !== activeOrderId ||
      detail.value?.order.orderId !== orderId ||
      !canComplete.value
    ) {
      return;
    }
    const request = snapshotOperation(orderId);
    completing.value = true;
    completeError.value = "";
    try {
      const next = await completeErrandOrder(orderId);
      if (!isCurrentOperation(request)) return;
      if (next) {
        adoptTerminalDetail(next);
        return;
      } else {
        completeError.value = ERRAND_ORDER_COMPLETE_FAILED;
      }
    } catch (error) {
      if (!isCurrentOperation(request)) return;
      completeError.value = extractErrorMessage(error, ERRAND_ORDER_COMPLETE_FAILED);
    } finally {
      if (isCurrentOperation(request)) completing.value = false;
    }
  }

  return {
    detail,
    loading,
    loaded,
    errorMessage,
    cancelling,
    cancelError,
    completing,
    completeError,
    canCancel,
    canComplete,
    loadCurrentUserId,
    resetCurrentUserId,
    refresh,
    start,
    stop,
    cancel,
    complete,
  };
}
