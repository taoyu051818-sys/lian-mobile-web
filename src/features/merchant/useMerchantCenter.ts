/**
 * Merchant center state composable (issue #646).
 *
 * Owns two read-only round-trips:
 *   - `GET /api/auth/me` → drives the merchant_verified gate decision via
 *     `useIsMerchantVerified`. Source of truth lives here so the view does
 *     not have to reach into the profile feature for a user ref (the layer
 *     guard rejects cross-feature imports of private internals).
 *   - `GET /api/me/posts` (via `fetchMyMerchantPosts`) → returns the user's
 *     authored posts filtered to the merchant subset. No new backend route
 *     is introduced.
 *
 * Errand-order routes (PRD §12) are out of scope here; the per-post errand
 * eligibility readout lives on the post detail surface, not the merchant
 * center list.
 */
import { ref } from "vue";
import { fetchMyMerchantPosts } from "../../api/merchant";
import { fetchAuthMe } from "../../api/profile";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { MERCHANT_CENTER_LOAD_ERROR } from "../../config/brand";
import type { MerchantCenterPostItem } from "../../types/merchant";
import type { ProfileUser } from "../../types/profile";
import { useIsMerchantVerified } from "./useIsMerchantVerified";

export function useMerchantCenter() {
  const user = ref<ProfileUser | null>(null);
  const posts = ref<MerchantCenterPostItem[]>([]);
  const loading = ref(false);
  const errorMessage = ref("");
  const loaded = ref(false);
  const isMerchantVerified = useIsMerchantVerified(user);

  /**
   * Refresh `/api/auth/me`. Updates the merchant_verified gate. Returns
   * `true` when the call succeeded so the caller can branch on the gate
   * decision before kicking off the post list refresh.
   */
  async function refreshSession(): Promise<boolean> {
    try {
      user.value = await fetchAuthMe();
      return true;
    } catch {
      // Session probe failure is silent — the gate falls back to "not
      // merchant_verified" which routes to the verification center, the
      // same UX a logged-out user would get.
      user.value = null;
      return false;
    }
  }

  /**
   * Refresh the merchant post list. Caller is responsible for ensuring the
   * gate is open before invoking this; otherwise we return early so a guest
   * does not pay the cost of a /api/me/posts probe that will 401.
   */
  async function refresh() {
    if (!isMerchantVerified.value) return;
    loading.value = true;
    errorMessage.value = "";
    try {
      posts.value = await fetchMyMerchantPosts();
      loaded.value = true;
    } catch (error) {
      // Keep `loaded=false` so the view stays on the loading/error state and
      // does not flash an empty list when the only failure is transport.
      errorMessage.value = extractErrorMessage(error, MERCHANT_CENTER_LOAD_ERROR);
    } finally {
      loading.value = false;
    }
  }

  return {
    user,
    posts,
    loading,
    loaded,
    errorMessage,
    isMerchantVerified,
    refreshSession,
    refresh,
  };
}
