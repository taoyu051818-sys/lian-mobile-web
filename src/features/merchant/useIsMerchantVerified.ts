import { computed, type Ref } from "vue";

/**
 * Returns true when the user record carries an active `merchant_verified`
 * verification tag. Treats `verificationState.merchant_verified.active` as
 * authoritative when present, falling back to the flat tag list. Mirrors
 * the gating logic used by `useIsRunnerVerified` and
 * `ProfileVerificationBadges` so the merchant-center entry follows the same
 * truth table as every other verification surface.
 */
export function useIsMerchantVerified(
  user: Ref<{
    verificationState?: { merchant_verified?: { active?: boolean } | undefined } | undefined;
    verificationTags?: string[];
    tags?: string[];
  } | null>,
) {
  return computed(() => {
    const u = user.value;
    if (!u) return false;
    const record = u.verificationState?.merchant_verified;
    if (record) return Boolean(record.active);
    const flat = new Set<string>([...(u.verificationTags || []), ...(u.tags || [])]);
    return flat.has("merchant_verified");
  });
}
