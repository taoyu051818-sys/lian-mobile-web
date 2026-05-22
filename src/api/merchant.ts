/**
 * Merchant center API (issue #646).
 *
 * Source endpoints (no new route — see `types/merchant.ts` for rationale):
 *   - `GET /api/me/posts` — current user's authored posts. We filter to the
 *     merchant subset by inspecting `presentationIntent`, `contentType`, and
 *     the optional inline `merchant` block. Anything that looks merchant-
 *     flavored is rolled up into a `MerchantCenterPostItem`.
 *   - `GET /api/auth/me` — owns the merchant_verified gate; the
 *     `useIsMerchantVerified` composable wraps that.
 *
 * Errand-order routes (PRD §12) are intentionally NOT exposed here — the
 * merchant center is read-only state plumbing; the order state machine lives
 * in #647/#648. We keep `normalizeMerchantErrandEligibility` here because the
 * post-detail normalizer (`api/posts.ts`) imports it for the unavailable-
 * reason readout on the post detail block.
 */
import { apiGet } from "./http";
import { asBoolean, asNumber, asRecord, asString } from "../platform/api-normalizers";
import type {
  MerchantCenterPostItem,
  MerchantErrandEligibility,
  MerchantErrandUnavailableReason,
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

/**
 * Detect a merchant post from a list item. We accept three signals so the
 * detector keeps working as the wire shape evolves:
 *   - `metadata.presentationIntent === "merchant"` (post-PR-V607)
 *   - `contentType` starts with `merchant_` (food/service/retail family)
 *   - inline `metadata.merchant` block — even partial (any object presence)
 *
 * Returns the inline merchant record + presentation flags so the caller can
 * pull `hours` / `errandSupported` without re-walking the payload.
 */
function readMerchantSignal(value: unknown): {
  isMerchant: boolean;
  hours: string;
  errandSupported: boolean;
} {
  const record = asRecord(value);
  const metadata = asRecord(record.metadata);
  const presentationIntent = asString(metadata.presentationIntent).toLowerCase();
  const contentType = asString(record.contentType ?? metadata.contentType).toLowerCase();
  // Top-level `merchant` block (post detail wire) AND `metadata.merchant`
  // (raw post wire) both occur in the wild — accept either.
  const merchantBlockRaw = record.merchant !== undefined ? record.merchant : metadata.merchant;
  const merchantBlock = asRecord(merchantBlockRaw);
  const hasMerchantBlock = Object.keys(merchantBlock).length > 0;

  const isMerchant =
    presentationIntent === "merchant" || contentType.startsWith("merchant_") || hasMerchantBlock;

  return {
    isMerchant,
    hours: asString(merchantBlock.hours),
    errandSupported: asBoolean(merchantBlock.errandSupported),
  };
}

export function normalizeMerchantCenterPostItem(value: unknown): MerchantCenterPostItem | null {
  const record = asRecord(value);
  const tid = Math.trunc(asNumber(record.tid, 0));
  if (!Number.isFinite(tid) || tid <= 0) return null;
  const signal = readMerchantSignal(record);
  if (!signal.isMerchant) return null;
  return {
    tid,
    title: asString(record.title),
    hours: signal.hours,
    errandSupported: signal.errandSupported,
  };
}

/**
 * Fetch the current user's authored posts and reduce to the merchant subset.
 * Uses `/api/me/posts` (the same endpoint the profile "发布" tab consumes) so
 * the merchant center never invents a backend surface. Items without any
 * merchant signal are dropped client-side; an empty result is the legitimate
 * "no merchant content yet" state.
 */
export async function fetchMyMerchantPosts(): Promise<MerchantCenterPostItem[]> {
  const data = await apiGet<unknown>("/api/me/posts");
  const record = asRecord(data);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items: MerchantCenterPostItem[] = [];
  for (const raw of rawItems) {
    const item = normalizeMerchantCenterPostItem(raw);
    if (item) items.push(item);
  }
  return items;
}
