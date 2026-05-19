/**
 * Merchant center state composable (issue #646).
 *
 * Owns the GET /api/me/merchant-center round-trip and exposes the snapshot to
 * the gate + center view. The composable does NOT own the merchant_verified
 * gate decision — that always comes off the snapshot directly so the view can
 * branch without an extra /api/auth/me call.
 *
 * Errand-order routes (PRD §12) are out of scope here; this composable only
 * surfaces the read-only `errand` block from the merchant-center DTO.
 */
import { computed, ref } from "vue";
import { fetchMerchantCenter } from "../../api/merchant";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { MERCHANT_CENTER_LOAD_ERROR } from "../../config/brand";
import type { MerchantCenterSnapshot } from "../../types/merchant";

function emptySnapshot(): MerchantCenterSnapshot {
  return {
    merchantVerified: false,
    profile: null,
    errand: { available: false, reason: "", reasonText: "" },
  };
}

export function useMerchantCenter() {
  const snapshot = ref<MerchantCenterSnapshot>(emptySnapshot());
  const loading = ref(false);
  const errorMessage = ref("");
  const loaded = ref(false);

  const merchantVerified = computed(() => snapshot.value.merchantVerified);
  const profile = computed(() => snapshot.value.profile);
  const errand = computed(() => snapshot.value.errand);

  async function refresh() {
    loading.value = true;
    errorMessage.value = "";
    try {
      snapshot.value = await fetchMerchantCenter();
      loaded.value = true;
    } catch (error) {
      // Keep `loaded=false` so the view stays on the loading/error state and
      // the gate is not flashed when the only failure is transport.
      errorMessage.value = extractErrorMessage(error, MERCHANT_CENTER_LOAD_ERROR);
    } finally {
      loading.value = false;
    }
  }

  return {
    snapshot,
    loading,
    loaded,
    errorMessage,
    merchantVerified,
    profile,
    errand,
    refresh,
  };
}
