/**
 * Merchant center (issue #646) types.
 *
 * Backend (`/api/me/merchant-center`) ships a profile readout for merchants who
 * hold an active `merchant_verified` grant: a snapshot of their merchant
 * identity (name + category) and the errand eligibility currently applied to
 * any merchant post they would publish. Errand state-machine (#647/#648) is
 * out of scope here — this module only carries the "can the entry render"
 * signal plus a reason string when it's unavailable.
 *
 * Wire shape mirrors the backend payload exactly so the normalizer stays
 * field-by-field. Optional fields degrade to empty strings rather than
 * undefined to match the rest of the API surface.
 */

import type { MerchantCategory } from "./post-extensions";

/**
 * Reason codes the backend may attach when `errandEntryAvailable` is false.
 * Kept as a string union for forward compatibility — unknown codes degrade to
 * `unknown` and the UI falls back to the generic copy.
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

export interface MerchantProfileSummary {
  name: string;
  category: MerchantCategory;
  hours: string;
  contact: string;
  /** ISO timestamp of the active `merchant_verified` grant. */
  verifiedAt: string;
  /** Default errandSupported flag the merchant has configured for new posts. */
  errandSupported: boolean;
}

export interface MerchantCenterSnapshot {
  /** True iff `/api/auth/me` reports an active `merchant_verified` grant. */
  merchantVerified: boolean;
  /** Profile readout — present iff `merchantVerified=true`. */
  profile: MerchantProfileSummary | null;
  errand: MerchantErrandEligibility;
}
