/**
 * Read-side composable for the errand order timeline view (issue #647).
 *
 * Wraps `GET /api/errand-orders/:id`. The state machine itself is owned by
 * #648, so this composable does not poll for transitions — it loads once on
 * mount and exposes a `refresh()` so the caller can re-pull on user action.
 */
import { ref } from "vue";
import { fetchErrandOrder } from "../../api/errands";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { ERRAND_ORDER_DETAIL_LOAD_ERROR } from "../../config/brand";
import type { ErrandOrderDetail } from "../../types/errand";

export function useErrandOrderDetail() {
  const detail = ref<ErrandOrderDetail | null>(null);
  const loading = ref(false);
  const loaded = ref(false);
  const errorMessage = ref("");

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

  return {
    detail,
    loading,
    loaded,
    errorMessage,
    refresh,
  };
}
