import { computed, ref } from "vue";
import { fetchAuthMe } from "../../api/profile";
import type { MerchantContentType, MerchantPublishInput } from "../../types/publish";
import type { MerchantCategory } from "../../types/post-extensions";
import type { ProfileUser } from "../../types/profile";

/**
 * Publish-side merchant draft + verification gate.
 *
 * Owns:
 *  - merchant form fields (name / category / hours / contact / errandSupported)
 *  - the `merchant_verified` gate state derived from /api/auth/me
 *  - `contentType` (merchant_food / _service / _retail) tracking the chosen category
 *
 * Stays out of:
 *  - submit wiring (lives in usePublishSubmit, which reads `payload()`)
 *  - non-merchant publish flow (PublishView decides whether to use this)
 */
export function useMerchantPublishDraft() {
  const name = ref("");
  const category = ref<MerchantCategory>("food");
  const hours = ref("");
  const contact = ref("");
  const errandSupported = ref(false);
  const merchantVerified = ref(false);
  const verificationLoaded = ref(false);

  const contentType = computed<MerchantContentType>(() => {
    switch (category.value) {
      case "service":
        return "merchant_service";
      case "retail":
        return "merchant_retail";
      default:
        return "merchant_food";
    }
  });

  const trimmedName = computed(() => name.value.trim());
  const canSubmit = computed(() => merchantVerified.value && trimmedName.value.length > 0);

  function readVerification(user: ProfileUser | null): boolean {
    if (!user) return false;
    const record = user.verificationState?.merchant_verified;
    if (record) return Boolean(record.active);
    return Array.isArray(user.verificationTags)
      ? user.verificationTags.includes("merchant_verified")
      : Array.isArray(user.tags)
        ? user.tags.includes("merchant_verified")
        : false;
  }

  async function refreshVerification() {
    try {
      const user = await fetchAuthMe();
      merchantVerified.value = readVerification(user);
    } catch {
      merchantVerified.value = false;
    } finally {
      verificationLoaded.value = true;
    }
  }

  function payload(): { input: MerchantPublishInput; contentType: MerchantContentType } {
    return {
      input: {
        name: trimmedName.value,
        category: category.value,
        hours: hours.value.trim(),
        contact: contact.value.trim(),
        errandSupported: errandSupported.value,
      },
      contentType: contentType.value,
    };
  }

  function reset() {
    name.value = "";
    category.value = "food";
    hours.value = "";
    contact.value = "";
    errandSupported.value = false;
  }

  return {
    name,
    category,
    hours,
    contact,
    errandSupported,
    merchantVerified,
    verificationLoaded,
    contentType,
    canSubmit,
    refreshVerification,
    payload,
    reset,
  };
}
