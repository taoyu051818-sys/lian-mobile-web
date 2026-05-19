import { ref } from "vue";
import { fetchAuthMe } from "../../api/profile";
import type { TradeContentType, TradePublishInput } from "../../types/publish";
import type { TradeState } from "../../types/post-extensions";
import type { ProfileUser } from "../../types/profile";

/**
 * Publish-side trade draft + verification gate.
 *
 * Owns:
 *  - trade form fields (price / state / category)
 *  - the `campus_verified` gate state derived from /api/auth/me
 *
 * Stays out of:
 *  - submit wiring (lives in usePublishSubmit, which reads `payload()`)
 *  - non-trade publish flow (PublishView decides whether to use this)
 *
 * Backend (#387) accepts a single contentType="trade"; category is free-text
 * inside the trade block. State defaults to "available" — sellers can flip it
 * to "reserved" or "sold" later via state-transition endpoints (out of scope
 * for #608, see follow-up).
 */
export function useTradePublishDraft() {
  const price = ref("");
  const state = ref<TradeState>("available");
  const category = ref("");
  const campusVerified = ref(false);
  const verificationLoaded = ref(false);

  const contentType: TradeContentType = "trade";

  function readVerification(user: ProfileUser | null): boolean {
    if (!user) return false;
    const record = user.verificationState?.campus_verified;
    if (record) return Boolean(record.active);
    return Array.isArray(user.verificationTags)
      ? user.verificationTags.includes("campus_verified")
      : Array.isArray(user.tags)
        ? user.tags.includes("campus_verified")
        : false;
  }

  async function refreshVerification() {
    try {
      const user = await fetchAuthMe();
      campusVerified.value = readVerification(user);
    } catch {
      campusVerified.value = false;
    } finally {
      verificationLoaded.value = true;
    }
  }

  function payload(): { input: TradePublishInput; contentType: TradeContentType } {
    return {
      input: {
        price: price.value.trim(),
        state: state.value,
        category: category.value.trim(),
      },
      contentType,
    };
  }

  function reset() {
    price.value = "";
    state.value = "available";
    category.value = "";
  }

  function canSubmit(): boolean {
    return campusVerified.value && price.value.trim().length > 0;
  }

  return {
    price,
    state,
    category,
    campusVerified,
    verificationLoaded,
    canSubmit,
    refreshVerification,
    payload,
    reset,
  };
}
