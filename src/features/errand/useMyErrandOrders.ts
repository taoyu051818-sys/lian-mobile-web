/**
 * "我的跑腿订单" composable (issue #647 follow-up).
 *
 * Backs the profile-side list of the requester's own errand orders so
 * users can re-enter the timeline view after closing it. Kept tiny — the
 * view itself dispatches into the route singleton + setActiveView.
 */
import { ref } from "vue";
import { fetchMyErrandOrders } from "../../api/errands";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { PROFILE_ERRAND_ORDERS_LOAD_ERROR } from "../../config/brand";
import type { ErrandOrderSummary } from "../../types/errand";

export function useMyErrandOrders() {
  const items = ref<ErrandOrderSummary[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref("");

  async function refresh() {
    loading.value = true;
    errorMessage.value = "";
    try {
      const next = await fetchMyErrandOrders();
      items.value = next.items;
      loaded.value = true;
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, PROFILE_ERRAND_ORDERS_LOAD_ERROR);
    } finally {
      loading.value = false;
    }
  }

  return {
    items,
    loading,
    loaded,
    errorMessage,
    refresh,
  };
}
