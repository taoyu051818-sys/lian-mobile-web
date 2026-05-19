/**
 * Maps merchant errand reason codes to localized copy. Centralized so the
 * detail page (PostDetailMerchantBlock) and the merchant-center surface stay
 * in sync — the frontend never invents reason text, it only translates a
 * known code into a string. Unknown codes (and the generic "unknown" code)
 * fall back to the generic copy.
 */
import {
  MERCHANT_CATEGORY_FOOD,
  MERCHANT_CATEGORY_RETAIL,
  MERCHANT_CATEGORY_SERVICE,
  MERCHANT_ERRAND_REASON_MERCHANT_PAUSED,
  MERCHANT_ERRAND_REASON_NOT_VERIFIED,
  MERCHANT_ERRAND_REASON_NO_RUNNER_COVERAGE,
  MERCHANT_ERRAND_REASON_OFF_HOURS,
  MERCHANT_ERRAND_UNAVAILABLE_FALLBACK,
} from "../../config/brand";
import type { MerchantCategory } from "../../types/post-extensions";
import type { MerchantErrandEligibility } from "../../types/merchant";

export const MERCHANT_CATEGORY_LABELS: Record<MerchantCategory, string> = {
  food: MERCHANT_CATEGORY_FOOD,
  service: MERCHANT_CATEGORY_SERVICE,
  retail: MERCHANT_CATEGORY_RETAIL,
};

export function categoryLabel(category: MerchantCategory): string {
  return MERCHANT_CATEGORY_LABELS[category];
}

export function errandReasonText(eligibility: MerchantErrandEligibility): string {
  if (eligibility.available) return "";
  // Server-supplied prose wins — gives backend a way to localize / explain
  // case-by-case without a frontend release.
  if (eligibility.reasonText) return eligibility.reasonText;
  switch (eligibility.reason) {
    case "not_verified":
      return MERCHANT_ERRAND_REASON_NOT_VERIFIED;
    case "no_runner_coverage":
      return MERCHANT_ERRAND_REASON_NO_RUNNER_COVERAGE;
    case "off_hours":
      return MERCHANT_ERRAND_REASON_OFF_HOURS;
    case "merchant_paused":
      return MERCHANT_ERRAND_REASON_MERCHANT_PAUSED;
    default:
      return MERCHANT_ERRAND_UNAVAILABLE_FALLBACK;
  }
}

export function formatVerifiedAt(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return raw;
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
