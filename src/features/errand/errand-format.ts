/**
 * Errand order — reason / status copy + tiny formatters.
 *
 * Centralised so the gate, form, and timeline all dispatch off the same
 * code → string table. Keeping this here (instead of in the component) lets
 * `tests/errand/*` exercise dispatch directly without instantiating Vue.
 */
import {
  ERRAND_ORDER_DETAIL_TIMELINE,
  ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE,
  ERRAND_ORDER_GATE_MERCHANT_PAUSED,
  ERRAND_ORDER_GATE_NOT_LOGGED_IN,
  ERRAND_ORDER_GATE_NOT_VERIFIED,
  ERRAND_ORDER_GATE_NO_RUNNER_COVERAGE,
  ERRAND_ORDER_GATE_UNKNOWN,
  ERRAND_ORDER_MODE_BATCH,
  ERRAND_ORDER_MODE_DEDICATED,
  ERRAND_ORDER_STATUS_ASSIGNED,
  ERRAND_ORDER_STATUS_AT_SHOP,
  ERRAND_ORDER_STATUS_CANCELLED,
  ERRAND_ORDER_STATUS_COMPLETED,
  ERRAND_ORDER_STATUS_CREATED,
  ERRAND_ORDER_STATUS_DELIVERED,
  ERRAND_ORDER_STATUS_DELIVERING,
  ERRAND_ORDER_STATUS_DISPUTED,
  ERRAND_ORDER_STATUS_PAID_LOCKED,
  ERRAND_ORDER_STATUS_PICKED_UP,
  ERRAND_ORDER_STATUS_REFUNDED,
  ERRAND_ORDER_STATUS_UNKNOWN,
} from "../../config/brand";
import type { ErrandMode, ErrandStatus } from "../../types/errand";
import type { ErrandOrderGate, ErrandOrderGateReason } from "../../types/errand";

export function gateReasonText(gate: ErrandOrderGate | null | undefined): string {
  if (!gate || gate.ok) return "";
  if (gate.reasonText) return gate.reasonText;
  return gateReasonFallback(gate.reason);
}

export function gateReasonFallback(reason: ErrandOrderGateReason | ""): string {
  switch (reason) {
    case "not_logged_in":
      return ERRAND_ORDER_GATE_NOT_LOGGED_IN;
    case "not_verified":
      return ERRAND_ORDER_GATE_NOT_VERIFIED;
    case "insufficient_balance":
      return ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE;
    case "merchant_paused":
      return ERRAND_ORDER_GATE_MERCHANT_PAUSED;
    case "no_runner_coverage":
      return ERRAND_ORDER_GATE_NO_RUNNER_COVERAGE;
    case "unknown":
      return ERRAND_ORDER_GATE_UNKNOWN;
    default:
      return "";
  }
}

export const ERRAND_STATUS_LABELS: Record<ErrandStatus, string> = {
  created: ERRAND_ORDER_STATUS_CREATED,
  paid_locked: ERRAND_ORDER_STATUS_PAID_LOCKED,
  assigned: ERRAND_ORDER_STATUS_ASSIGNED,
  at_shop: ERRAND_ORDER_STATUS_AT_SHOP,
  picked_up: ERRAND_ORDER_STATUS_PICKED_UP,
  delivering: ERRAND_ORDER_STATUS_DELIVERING,
  delivered: ERRAND_ORDER_STATUS_DELIVERED,
  completed: ERRAND_ORDER_STATUS_COMPLETED,
  cancelled: ERRAND_ORDER_STATUS_CANCELLED,
  refunded: ERRAND_ORDER_STATUS_REFUNDED,
  disputed: ERRAND_ORDER_STATUS_DISPUTED,
  unknown: ERRAND_ORDER_STATUS_UNKNOWN,
};

export function statusLabel(status: ErrandStatus): string {
  return ERRAND_STATUS_LABELS[status] || ERRAND_ORDER_DETAIL_TIMELINE;
}

export const MODE_LABELS: Record<ErrandMode, string> = {
  dedicated: ERRAND_ORDER_MODE_DEDICATED,
  meal_peak_batch: ERRAND_ORDER_MODE_BATCH,
};

export function modeLabel(mode: ErrandMode): string {
  return MODE_LABELS[mode];
}

/**
 * Statuses where there is nothing left for the backend to transition to —
 * polling stops once we reach one of these, otherwise we keep ticking. Kept
 * here (instead of inside the timeline view) so `useErrandOrderDetail` and
 * any future "my orders" list dispatch off the same source of truth.
 *
 * `disputed` is intentionally NOT terminal: a dispute can still resolve to
 * delivered or refunded, and the user expects to see that pivot live.
 */
const TERMINAL_ERRAND_STATUSES = new Set<ErrandStatus>([
  "delivered",
  "completed",
  "cancelled",
  "refunded",
]);

export function isTerminalErrandStatus(status: ErrandStatus | undefined | null): boolean {
  return !!status && TERMINAL_ERRAND_STATUSES.has(status);
}

export function formatTimelineTimestamp(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return raw;
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
