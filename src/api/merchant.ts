/**
 * Merchant center API (issue #646).
 *
 * `GET /api/me/merchant-center` returns the merchant readout for the signed-in
 * user. Backend gates the response on `merchant_verified` — when the grant is
 * absent, the route still answers 200 with `merchantVerified=false` so the
 * client can render the upsell gate without a second round-trip. We mirror
 * that contract so the view never has to distinguish "missing grant" from
 * "transport error".
 *
 * Errand-order routes (PRD §12) are intentionally NOT exposed here — the
 * merchant center is read-only state plumbing; the order state machine lives
 * in #647/#648.
 */
import { apiGet } from "./http";
import {
  asBoolean,
  asRecord,
  asString,
  normalizeMerchantExtension,
} from "../platform/api-normalizers";
import type {
  MerchantCenterSnapshot,
  MerchantErrandEligibility,
  MerchantErrandUnavailableReason,
  MerchantProfileSummary,
} from "../types/merchant";

const ERRAND_REASON_CODES: ReadonlySet<MerchantErrandUnavailableReason> = new Set([
  "not_verified",
  "no_runner_coverage",
  "off_hours",
  "merchant_paused",
  "unknown",
]);

function normalizeErrandReason(value: unknown): MerchantErrandUnavailableReason | "" {
  const raw = asString(value).toLowerCase();
  if (!raw) return "";
  return ERRAND_REASON_CODES.has(raw as MerchantErrandUnavailableReason)
    ? (raw as MerchantErrandUnavailableReason)
    : "unknown";
}

export function normalizeMerchantErrandEligibility(value: unknown): MerchantErrandEligibility {
  const record = asRecord(value);
  const available = asBoolean(record.available);
  if (available) {
    return { available: true, reason: "", reasonText: "" };
  }
  return {
    available: false,
    reason: normalizeErrandReason(record.reason),
    reasonText: asString(record.reasonText),
  };
}

export function normalizeMerchantProfileSummary(value: unknown): MerchantProfileSummary | null {
  // Reuse the post-extension normalizer — wire shape is identical (name +
  // category + hours + contact + errandSupported + verifiedAt). Returning null
  // when the extension is unrecoverable keeps the gate path honest: a missing
  // `name` means the backend has no profile to surface yet.
  const merchant = normalizeMerchantExtension(value);
  if (!merchant) return null;
  return {
    name: merchant.name,
    category: merchant.category,
    hours: merchant.hours,
    contact: merchant.contact,
    errandSupported: merchant.errandSupported,
    verifiedAt: merchant.verifiedAt,
  };
}

export function normalizeMerchantCenterSnapshot(value: unknown): MerchantCenterSnapshot {
  const record = asRecord(value);
  const merchantVerified = asBoolean(record.merchantVerified);
  return {
    merchantVerified,
    profile: merchantVerified ? normalizeMerchantProfileSummary(record.profile) : null,
    errand: normalizeMerchantErrandEligibility(record.errand),
  };
}

export async function fetchMerchantCenter(): Promise<MerchantCenterSnapshot> {
  const data = await apiGet<unknown>("/api/me/merchant-center");
  return normalizeMerchantCenterSnapshot(data);
}
