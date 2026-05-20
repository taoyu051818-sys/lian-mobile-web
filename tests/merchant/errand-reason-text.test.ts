import { describe, expect, it } from "vitest";
import {
  MERCHANT_ERRAND_REASON_MERCHANT_PAUSED,
  MERCHANT_ERRAND_REASON_NOT_VERIFIED,
  MERCHANT_ERRAND_REASON_NO_RUNNER_COVERAGE,
  MERCHANT_ERRAND_REASON_OFF_HOURS,
  MERCHANT_ERRAND_UNAVAILABLE_FALLBACK,
} from "../../src/config/brand";
// Import the helper directly from its source module rather than via the
// `features/merchant` barrel — the barrel re-exports `.vue` SFCs that vitest
// cannot transform without `@vitejs/plugin-vue` configured. The existing
// `tests/detail/report-flow.contract.test.ts` follows the same pattern.
import { errandReasonText } from "../../src/features/merchant/merchant-format";

/**
 * Issue #693 acceptance: when the merchant detail page detects an unavailable
 * errand entry, the surface MUST show the backend's `reasonText` instead of
 * silently hiding the journey or rendering a generic placeholder. These tests
 * pin the dispatch contract so a future refactor cannot drop the
 * "server prose wins" rule without breaking here.
 */
describe("errandReasonText (issue #693 — surface backend reason on unavailable)", () => {
  it("returns empty when the entry is available (caller decides whether to render)", () => {
    expect(errandReasonText({ available: true, reason: "", reasonText: "" })).toBe("");
    // Even if the backend still ships reasonText (defensive shape), available=true
    // wins — we never display rejection prose for an available entry.
    expect(
      errandReasonText({
        available: true,
        reason: "",
        reasonText: "stale prose from a previous probe",
      }),
    ).toBe("");
  });

  it("prefers backend-supplied reasonText over the localized code fallback", () => {
    // Backend gets the final word so it can localize / explain case-by-case
    // without a frontend release. The detail surface must NOT swap a
    // server-supplied explanation for the generic copy just because the code
    // is one we know how to translate.
    expect(
      errandReasonText({
        available: false,
        reason: "off_hours",
        reasonText: "今晚 22:00 后再来下单。",
      }),
    ).toBe("今晚 22:00 后再来下单。");

    expect(
      errandReasonText({
        available: false,
        reason: "no_runner_coverage",
        reasonText: "高峰挤爆了，本店附近无骑手，请稍后。",
      }),
    ).toBe("高峰挤爆了，本店附近无骑手，请稍后。");
  });

  it("falls back to the localized copy for each documented reason code", () => {
    expect(errandReasonText({ available: false, reason: "not_verified", reasonText: "" })).toBe(
      MERCHANT_ERRAND_REASON_NOT_VERIFIED,
    );
    expect(
      errandReasonText({ available: false, reason: "no_runner_coverage", reasonText: "" }),
    ).toBe(MERCHANT_ERRAND_REASON_NO_RUNNER_COVERAGE);
    expect(errandReasonText({ available: false, reason: "off_hours", reasonText: "" })).toBe(
      MERCHANT_ERRAND_REASON_OFF_HOURS,
    );
    expect(errandReasonText({ available: false, reason: "merchant_paused", reasonText: "" })).toBe(
      MERCHANT_ERRAND_REASON_MERCHANT_PAUSED,
    );
  });

  it("collapses the unknown sentinel + empty reason to the generic fallback string", () => {
    // The frontend never invents prose. When the backend can't tell us *why*,
    // we still must say *something* — the generic fallback. Silently hiding
    // the journey was the issue #693 regression.
    expect(errandReasonText({ available: false, reason: "unknown", reasonText: "" })).toBe(
      MERCHANT_ERRAND_UNAVAILABLE_FALLBACK,
    );
    expect(errandReasonText({ available: false, reason: "", reasonText: "" })).toBe(
      MERCHANT_ERRAND_UNAVAILABLE_FALLBACK,
    );
  });
});
