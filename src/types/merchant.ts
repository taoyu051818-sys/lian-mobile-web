/**
 * Merchant center (issue #646) types.
 *
 * The merchant center is a read-only surface for `merchant_verified` users.
 * Source data comes from two endpoints that already exist:
 *   - GET /api/auth/me → identity check (`merchant_verified` grant)
 *   - GET /api/me/posts → user's authored posts; filter to merchant items
 *     client-side using `metadata.presentationIntent` / `metadata.merchant`.
 *
 * No new backend route is introduced. An earlier iteration (PR #659) shipped
 * a `/api/me/merchant-center` endpoint, but the route was never deployed and
 * left the feature in a load-error state in production. Reusing the existing
 * `/api/me/posts` endpoint keeps the merchant center honest about what the
 * platform can answer today and aligns with NodeBB-native first.
 *
 * The errand-order state machine (PRD §12 / issue #647) stays out of scope
 * here — this module only carries the read-only post list plus the
 * eligibility signal that the post detail page surfaces.
 */

/**
 * Reason codes the backend may attach when an errand entry is unavailable.
 * Kept as a string union for forward compatibility — unknown codes degrade
 * to `unknown` and the UI falls back to the generic copy.
 */
export type MerchantErrandUnavailableReason =
  | "not_verified"
  | "no_runner_coverage"
  | "off_hours"
  | "merchant_paused"
  | "unknown";

export interface MerchantErrandEligibility {
  /** Whether the errand entry should render on this merchant's posts today. */
  available: boolean;
  /** Stable code (see union) when `available=false`; empty string otherwise. */
  reason: MerchantErrandUnavailableReason | "";
  /** Human-readable explanation; backend may localize it. Empty when available. */
  reasonText: string;
}

/**
 * Merchant-center list item — derived from `/api/me/posts` by filtering on
 * `metadata.presentationIntent === "merchant"`, the `merchant_*` content type
 * family, or the presence of a `metadata.merchant` block. Carries only the
 * fields the merchant-center view renders directly; the post detail page is
 * the canonical surface for the rest of the merchant block.
 */
export interface MerchantCenterPostItem {
  tid: number;
  title: string;
  /** Merchant's posted business hours; empty string when the publisher left it blank. */
  hours: string;
  /** Whether the publisher opted into the errand entry on this post. */
  errandSupported: boolean;
}
