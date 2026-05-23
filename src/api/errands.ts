/**
 * Errand order API client (issue #647).
 *
 * Surface:
 *   - GET  /api/errands/orders/eligibility?merchantPostId=:id  — pre-submit gate
 *   - POST /api/errands/orders                                 — create
 *   - GET  /api/errands/orders/:orderId                        — read + timeline
 *
 * The wire shapes follow the same conservative-normalization style as
 * `src/api/posts.ts` and `src/api/merchant.ts`: the backend may add fields
 * but never break existing ones, and unknown enum values collapse to a
 * documented sentinel (`unknown` reason / `created` status) rather than
 * surfacing as garbage.
 */
import { apiGet, apiSend, LianApiError } from "./http";
import {
  asBoolean,
  asEnum,
  asNonNegInt,
  asNumber,
  asRecord,
  asString,
} from "../platform/api-normalizers";
import type {
  ErrandMode,
  ErrandOrder,
  ErrandOrderCreateResponse,
  ErrandOrderDetail,
  ErrandOrderGate,
  ErrandOrderGateReason,
  ErrandOrderListResponse,
  ErrandOrderRequest,
  ErrandOrderSummary,
  ErrandOrderTimelineEvent,
  ErrandRunnerLocation,
  ErrandStatus,
} from "../types/errand";
import type { PostLocation } from "../types/post";

const GATE_REASON_CODES = new Set<ErrandOrderGateReason>([
  "not_logged_in",
  "not_verified",
  "insufficient_balance",
  "merchant_paused",
  "no_runner_coverage",
  "unknown",
]);

const ERRAND_STATUSES = new Set<ErrandStatus>([
  "created",
  "paid_locked",
  "assigned",
  "picked_up",
  "delivering",
  "delivered",
  "cancelled",
  "refunded",
  "disputed",
]);

const ERRAND_MODES = new Set<ErrandMode>(["dedicated", "meal_peak_batch"]);

const TIMELINE_ACTORS = new Set<ErrandOrderTimelineEvent["actor"]>([
  "system",
  "requester",
  "runner",
  "platform",
]);

function normalizePostLocation(value: unknown): PostLocation | null {
  const record = asRecord(value);
  const placeId = asString(record.placeId);
  const label = asString(record.label);
  if (!placeId && !label) return null;
  const lat = typeof record.lat === "number" && Number.isFinite(record.lat) ? record.lat : null;
  const lng = typeof record.lng === "number" && Number.isFinite(record.lng) ? record.lng : null;
  return { placeId, label, lat, lng };
}

export function normalizeErrandOrderGate(value: unknown): ErrandOrderGate {
  const record = asRecord(value);
  const ok = asBoolean(record.ok);
  const rawReason = asString(record.reason);
  // Treat unknown codes as the documented "unknown" sentinel — never let a
  // server-side string leak into UI dispatch.
  const reason =
    !ok && rawReason
      ? GATE_REASON_CODES.has(rawReason as ErrandOrderGateReason)
        ? (rawReason as ErrandOrderGateReason)
        : "unknown"
      : "";
  return {
    ok,
    reason,
    reasonText: ok ? "" : asString(record.reasonText),
    availablePoints: asNonNegInt(record.availablePoints),
    estimatedFeePoints: asNonNegInt(record.estimatedFeePoints),
  };
}

function normalizeRunnerLocation(value: unknown): ErrandRunnerLocation | undefined {
  const record = asRecord(value);
  const lat = asNumber(record.lat, Number.NaN);
  const lng = asNumber(record.lng, Number.NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return {
    lat,
    lng,
    updatedAt: asString(record.updatedAt),
  };
}

function normalizeErrandOrder(value: unknown): ErrandOrder | null {
  const record = asRecord(value);
  const orderId = asString(record.orderId);
  if (!orderId) return null;
  const pickup = normalizePostLocation(record.pickupLocation);
  const dropoff = normalizePostLocation(record.dropoffLocation);
  if (!pickup || !dropoff) return null;
  const status = asEnum(record.status, ERRAND_STATUSES) || "created";
  const mode = asEnum(record.mode, ERRAND_MODES) || "dedicated";
  const merchantPostIdRaw = asNumber(record.merchantPostId, Number.NaN);
  const merchantPostId = Number.isFinite(merchantPostIdRaw)
    ? Math.trunc(merchantPostIdRaw)
    : undefined;
  const runnerUserId = asString(record.runnerUserId);
  const etaSecondsRaw = asNumber(record.etaSeconds, Number.NaN);
  const etaSeconds =
    Number.isFinite(etaSecondsRaw) && etaSecondsRaw > 0 ? etaSecondsRaw : undefined;
  const runnerLocation = normalizeRunnerLocation(record.runnerLocation);
  return {
    orderId,
    requesterUserId: asString(record.requesterUserId),
    ...(runnerUserId ? { runnerUserId } : {}),
    ...(merchantPostId !== undefined ? { merchantPostId } : {}),
    pickupLocation: pickup,
    dropoffLocation: dropoff,
    mode,
    status,
    feeAmount: asNonNegInt(record.feeAmount),
    lockedBalanceAmount: asNonNegInt(record.lockedBalanceAmount),
    ...(etaSeconds !== undefined ? { etaSeconds } : {}),
    ...(runnerLocation ? { runnerLocation } : {}),
  };
}

function normalizeTimelineEvent(value: unknown): ErrandOrderTimelineEvent | null {
  const record = asRecord(value);
  const status = asEnum(record.status, ERRAND_STATUSES);
  const at = asString(record.at);
  if (!status || !at) return null;
  const actor = asEnum(record.actor, TIMELINE_ACTORS) || "system";
  const note = asString(record.note);
  return {
    status,
    at,
    actor,
    ...(note ? { note } : {}),
  };
}

export function normalizeErrandOrderDetail(value: unknown): ErrandOrderDetail | null {
  const record = asRecord(value);
  const order = normalizeErrandOrder(record.order ?? record);
  if (!order) return null;
  const rawTimeline = Array.isArray(record.timeline) ? record.timeline : [];
  const timeline = rawTimeline
    .map((entry) => normalizeTimelineEvent(entry))
    .filter((entry): entry is ErrandOrderTimelineEvent => entry !== null);
  // Backend usually ships `created` first; if the timeline is empty, synthesize
  // a single entry from the order record so the detail view always renders at
  // least one row.
  if (!timeline.length) {
    timeline.push({
      status: order.status,
      at: asString(record.createdAt),
      actor: "system",
    });
  }
  return {
    order,
    timeline,
    notes: asString(record.notes),
    createdAt: asString(record.createdAt) || timeline[0]?.at || "",
  };
}

export function normalizeErrandOrderCreateResponse(value: unknown): ErrandOrderCreateResponse {
  const record = asRecord(value);
  const ok = asBoolean(record.ok);
  if (ok) {
    const detail = normalizeErrandOrderDetail(record.order ?? record);
    return detail ? { ok: true, order: detail } : { ok: true };
  }
  const rawReason = asString(record.reason);
  const reason = GATE_REASON_CODES.has(rawReason as ErrandOrderGateReason)
    ? (rawReason as ErrandOrderGateReason)
    : "unknown";
  return {
    ok: false,
    reason,
    reasonText: asString(record.reasonText),
  };
}

export async function fetchErrandOrderEligibility(
  merchantPostId: number,
): Promise<ErrandOrderGate> {
  const data = await apiGet<unknown>(
    `/api/errands/orders/eligibility?merchantPostId=${encodeURIComponent(String(merchantPostId))}`,
  );
  return normalizeErrandOrderGate(data);
}

export async function createErrandOrder(
  request: ErrandOrderRequest,
): Promise<ErrandOrderCreateResponse> {
  const body: Record<string, unknown> = {
    merchantPostId: request.merchantPostId,
    pickupLocation: request.pickupLocation,
    dropoffLocation: request.dropoffLocation,
    mode: request.mode,
  };
  const trimmedNotes = (request.notes || "").trim();
  if (trimmedNotes) body.notes = trimmedNotes;
  const data = await apiSend<unknown>("/api/errands/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeErrandOrderCreateResponse(data);
}

export async function fetchErrandOrder(orderId: string): Promise<ErrandOrderDetail | null> {
  const data = await apiGet<unknown>(`/api/errands/orders/${encodeURIComponent(orderId)}`);
  return normalizeErrandOrderDetail(data);
}

/**
 * Cancel a non-terminal errand order. Hits the existing
 * `POST /api/errands/orders/:orderId/cancel` route on platform-server (one of
 * the five real V0.1 endpoints — the 501 routes are `assign` and
 * `runner-location`, both of which the user-side UI must not call).
 *
 * Returns the freshly-normalized detail when the backend echoes the order
 * back; falls back to a re-fetch when it doesn't, so the caller always gets
 * the latest timeline post-cancel.
 */
export async function cancelErrandOrder(orderId: string): Promise<ErrandOrderDetail | null> {
  const data = await apiSend<unknown>(`/api/errands/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
  });
  const detail = normalizeErrandOrderDetail(data);
  if (detail) return detail;
  // Backend may return a `{ ok: true }` shape without echoing the order;
  // fall back to a re-fetch so the timeline view re-renders with the
  // cancelled state.
  return fetchErrandOrder(orderId);
}

function normalizeErrandOrderSummary(value: unknown): ErrandOrderSummary | null {
  const record = asRecord(value);
  const orderId = asString(record.orderId);
  if (!orderId) return null;
  const status = asEnum(record.status, ERRAND_STATUSES) || "created";
  const mode = asEnum(record.mode, ERRAND_MODES) || "dedicated";
  const pickup = normalizePostLocation(record.pickupLocation);
  const dropoff = normalizePostLocation(record.dropoffLocation);
  return {
    orderId,
    status,
    mode,
    feeAmount: asNonNegInt(record.feeAmount),
    pickupLabel: pickup?.label || asString(record.pickupLabel),
    dropoffLabel: dropoff?.label || asString(record.dropoffLabel),
    createdAt: asString(record.createdAt),
  };
}

/**
 * Fetch the requester's own errand orders. The backend response may be a
 * bare array or `{ items: [...] }` — both are accepted so the route can
 * grow pagination later without a frontend release. Unparseable rows are
 * dropped (same conservative-normalization stance as `fetchErrandOrder`).
 */
export async function fetchMyErrandOrders(): Promise<ErrandOrderListResponse> {
  const data = await apiGet<unknown>(`/api/errands/orders/mine`);
  const record = asRecord(data);
  const rawItems = Array.isArray(data) ? data : Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .map((entry) => normalizeErrandOrderSummary(entry))
    .filter((entry): entry is ErrandOrderSummary => entry !== null);
  return { items };
}

/**
 * Errand order share card (mw#892 / ps#552).
 *
 * Backend route: `GET /api/errands/orders/:orderId/share-card`. Returns a
 * WeChat-ready share card for recruiting runners. Only available for orders
 * in `pending` or `accepted` status — terminal orders return 404.
 */
export interface ErrandOrderShareCard {
  orderId: string;
  title: string;
  summary: string;
  thumbnailUrl: string;
  url: string;
  channel: {
    wechat?: {
      title: string;
      description: string;
      imageUrl: string;
    };
  };
}

export type ErrandOrderShareCardErrorReason = "not-found" | "network";

export class ErrandOrderShareCardError extends Error {
  reason: ErrandOrderShareCardErrorReason;
  status: number;

  constructor(reason: ErrandOrderShareCardErrorReason, status: number, message = "") {
    super(message || reason);
    this.name = "ErrandOrderShareCardError";
    this.reason = reason;
    this.status = status;
  }
}

function normalizeErrandOrderShareCard(
  value: unknown,
  fallbackOrderId: string,
): ErrandOrderShareCard {
  const record = asRecord(value);
  const channelRecord = asRecord(record.channel);
  const wechatRecord = asRecord(channelRecord.wechat);
  const wechat =
    wechatRecord.title || wechatRecord.description || wechatRecord.imageUrl
      ? {
          title: asString(wechatRecord.title),
          description: asString(wechatRecord.description),
          imageUrl: asString(wechatRecord.imageUrl),
        }
      : undefined;
  return {
    orderId: asString(record.orderId) || fallbackOrderId,
    title: asString(record.title),
    summary: asString(record.summary),
    thumbnailUrl: asString(record.thumbnailUrl),
    url: asString(record.url),
    channel: wechat ? { wechat } : {},
  };
}

export async function fetchErrandOrderShareCard(orderId: string): Promise<ErrandOrderShareCard> {
  try {
    const data = await apiGet<unknown>(
      `/api/errands/orders/${encodeURIComponent(orderId)}/share-card`,
    );
    const record = asRecord(data);
    return normalizeErrandOrderShareCard(record.card ?? record, orderId);
  } catch (error) {
    if (error instanceof LianApiError) {
      if (error.status === 404) {
        throw new ErrandOrderShareCardError("not-found", 404, error.message);
      }
      throw new ErrandOrderShareCardError("network", error.status, error.message);
    }
    throw new ErrandOrderShareCardError("network", 0, error instanceof Error ? error.message : "");
  }
}
