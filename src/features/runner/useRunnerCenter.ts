import { computed, ref, type Ref } from "vue";
import { LianApiError } from "../../api/http";
import {
  acceptRunnerOrder,
  fetchActiveRunnerOrders,
  fetchAvailableRunnerOrders,
  markRunnerOrderAtShop,
  markRunnerOrderDelivered,
  markRunnerOrderPickedUp,
} from "../../api/runner";
import {
  RUNNER_ACTION_FAIL,
  RUNNER_ACTION_SUCCESS,
  RUNNER_LIST_LOAD_ERROR,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { RunnerOrder, RunnerTransitionAction } from "../../types/runner";

export type RunnerCenterTab = "available" | "active";

function isRunnerGateError(error: unknown) {
  return error instanceof LianApiError && (error.status === 401 || error.status === 403);
}

/**
 * Runner-center state holder. Owns the two lists, the in-flight pending
 * action map (so individual rows can show their own spinner without
 * blocking the others), and the central feedback strings for the view.
 *
 * Why two ref maps instead of a Vuex/Pinia store: the runner UI is
 * mounted once, replaces both lists on every refresh, and is gone the
 * moment the runner leaves the view. A scoped composable keeps the
 * state colocated with the only consumer.
 */
export function useRunnerCenter() {
  const availableOrders = ref<RunnerOrder[]>([]);
  const activeOrders = ref<RunnerOrder[]>([]);
  const availableLoading = ref(false);
  const activeLoading = ref(false);
  const availableError = ref("");
  const activeError = ref("");
  const availableNeedsRunnerGate = ref(false);
  const pendingActionByOrder = ref<Record<string, RunnerTransitionAction>>({});
  const actionMessage = ref("");
  const actionError = ref("");

  function clearMessages() {
    actionMessage.value = "";
    actionError.value = "";
  }

  async function loadAvailable() {
    availableLoading.value = true;
    availableError.value = "";
    availableNeedsRunnerGate.value = false;
    try {
      const data = await fetchAvailableRunnerOrders();
      availableOrders.value = data.items;
    } catch (error) {
      if (isRunnerGateError(error)) {
        availableOrders.value = [];
        availableNeedsRunnerGate.value = true;
      } else {
        availableError.value = extractErrorMessage(error, RUNNER_LIST_LOAD_ERROR);
      }
    } finally {
      availableLoading.value = false;
    }
  }

  async function loadActive() {
    activeLoading.value = true;
    activeError.value = "";
    try {
      const data = await fetchActiveRunnerOrders();
      activeOrders.value = data.items;
    } catch (error) {
      activeError.value = extractErrorMessage(error, RUNNER_LIST_LOAD_ERROR);
    } finally {
      activeLoading.value = false;
    }
  }

  function applyUpdated(updated: RunnerOrder, removeFromAvailable = false) {
    if (removeFromAvailable) {
      availableOrders.value = availableOrders.value.filter((o) => o.id !== updated.id);
    } else {
      const idx = availableOrders.value.findIndex((o) => o.id === updated.id);
      if (idx >= 0) availableOrders.value[idx] = updated;
    }
    const activeIdx = activeOrders.value.findIndex((o) => o.id === updated.id);
    // After an `accept` the order moves out of `available` and into `active`;
    // a `deliver` removes it from `active` because the runner is done with it.
    if (updated.status === "delivered" || updated.status === "cancelled") {
      activeOrders.value = activeOrders.value.filter((o) => o.id !== updated.id);
      return;
    }
    if (activeIdx >= 0) activeOrders.value[activeIdx] = updated;
    else if (updated.status !== "available") activeOrders.value = [updated, ...activeOrders.value];
  }

  async function runTransition(
    orderId: string,
    action: RunnerTransitionAction,
    runner: () => Promise<RunnerOrder>,
  ): Promise<boolean> {
    pendingActionByOrder.value = { ...pendingActionByOrder.value, [orderId]: action };
    clearMessages();
    try {
      const updated = await runner();
      applyUpdated(updated, action === "accept");
      actionMessage.value = RUNNER_ACTION_SUCCESS;
      return true;
    } catch (error) {
      actionError.value = extractErrorMessage(error, RUNNER_ACTION_FAIL);
      return false;
    } finally {
      const next = { ...pendingActionByOrder.value };
      delete next[orderId];
      pendingActionByOrder.value = next;
    }
  }

  async function accept(orderId: string) {
    return runTransition(orderId, "accept", () => acceptRunnerOrder(orderId));
  }
  async function markAtShop(orderId: string) {
    return runTransition(orderId, "at_shop", () => markRunnerOrderAtShop(orderId));
  }
  async function markPickedUp(orderId: string) {
    return runTransition(orderId, "pickup", () => markRunnerOrderPickedUp(orderId));
  }
  async function markDelivered(orderId: string) {
    return runTransition(orderId, "deliver", () => markRunnerOrderDelivered(orderId));
  }

  function pendingActionFor(orderId: string): RunnerTransitionAction | undefined {
    return pendingActionByOrder.value[orderId];
  }

  return {
    availableOrders,
    activeOrders,
    availableLoading,
    activeLoading,
    availableError,
    activeError,
    availableNeedsRunnerGate,
    actionMessage,
    actionError,
    pendingActionByOrder,
    pendingActionFor,
    loadAvailable,
    loadActive,
    accept,
    markAtShop,
    markPickedUp,
    markDelivered,
    clearMessages,
  };
}

/**
 * Returns true when the user record carries an active `runner` verification
 * tag. Treats `verificationState.runner.active` as authoritative when
 * present, falling back to the flat tag list. Mirrors the gating logic
 * used elsewhere (ProfileVerificationBadges) for consistency.
 */
export function useIsRunnerVerified(
  user: Ref<{
    verificationState?: { runner?: { active?: boolean } | undefined } | undefined;
    verificationTags?: string[];
    tags?: string[];
  } | null>,
) {
  return computed(() => {
    const u = user.value;
    if (!u) return false;
    const record = u.verificationState?.runner;
    if (record) return Boolean(record.active);
    const flat = new Set<string>([...(u.verificationTags || []), ...(u.tags || [])]);
    return flat.has("runner");
  });
}
