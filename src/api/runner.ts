import { apiGet, apiSend, LianApiError } from "./http";
import type { RunnerOrder, RunnerOrderListResponse, RunnerTransitionAction } from "../types/runner";

type BackendRunnerOrder = Partial<RunnerOrder> & {
  order?: BackendRunnerOrder;
  orderId?: string;
  state?: string;
  pickupLocation?: { label?: string; address?: string; lat?: number; lng?: number };
  dropoffLocation?: { label?: string; address?: string; lat?: number; lng?: number };
  feeAmount?: number;
  rewardAmount?: number;
  lockedBalanceAmount?: number;
  createdAt?: string;
  notes?: string;
};

type BackendRunnerOrderList = {
  items?: BackendRunnerOrder[];
  total?: number;
  nextOffset?: number | null;
};

function normalizeRunnerStatus(value: unknown): RunnerOrder["status"] {
  if (value === "paid_locked" || value === "created") return "available";
  if (value === "assigned") return "accepted";
  if (value === "at_shop") return "at_shop";
  // V0.1 pickup auto-advances the backend to `delivering`. The runner UI has
  // no separate in-transit action, so keep presenting it as the deliverable
  // `picked_up` state.
  if (value === "delivering") return "picked_up";
  if (
    value === "picked_up" ||
    value === "delivered" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "refunded"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeOptionalPoints(...values: unknown[]): number | undefined {
  for (const value of values) {
    const amount =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : Number.NaN;
    if (Number.isFinite(amount) && amount >= 0) return Math.trunc(amount);
  }
  return undefined;
}

function normalizeRunnerOrder(value: BackendRunnerOrder): RunnerOrder | null {
  const source = value.order || value;
  const id = String(source.id || source.orderId || "");
  if (!id) return null;
  const normalized: RunnerOrder = {
    id,
    status: normalizeRunnerStatus(source.status || source.state),
    title: String(source.title || source.summary || id),
  };
  if (source.summary) normalized.summary = source.summary;
  const pickup = source.pickup || source.pickupLocation;
  if (pickup) normalized.pickup = pickup;
  const dropoff = source.dropoff || source.dropoffLocation;
  if (dropoff) normalized.dropoff = dropoff;
  const feePoints = normalizeOptionalPoints(source.feePoints, source.feeAmount);
  if (feePoints !== undefined) normalized.feePoints = feePoints;
  const rewardPoints = normalizeOptionalPoints(source.rewardPoints, source.rewardAmount);
  if (rewardPoints !== undefined) normalized.rewardPoints = rewardPoints;
  const totalLockedPoints = normalizeOptionalPoints(
    source.totalLockedPoints,
    source.lockedBalanceAmount,
  );
  if (totalLockedPoints !== undefined) normalized.totalLockedPoints = totalLockedPoints;
  if (source.createdAt) normalized.createdAt = source.createdAt;
  const note = source.note || source.notes;
  if (note) normalized.note = note;
  return normalized;
}

function normalizeRunnerOrderList(data: BackendRunnerOrderList): RunnerOrderListResponse {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = rawItems
    .map((entry) => normalizeRunnerOrder(entry))
    .filter((entry): entry is RunnerOrder => entry !== null);
  return { items, total: data.total ?? items.length };
}

/**
 * Available pool — orders not yet claimed by any runner.
 */
export async function fetchAvailableRunnerOrders(): Promise<RunnerOrderListResponse> {
  const data = await apiGet<BackendRunnerOrderList>("/api/errands/orders/available");
  return normalizeRunnerOrderList(data);
}

/**
 * Orders the current runner has accepted but not yet delivered.
 */
export async function fetchActiveRunnerOrders(): Promise<RunnerOrderListResponse> {
  const data = await apiGet<BackendRunnerOrderList>("/api/errands/orders/mine?role=runner");
  return normalizeRunnerOrderList(data);
}

async function transitionRunnerOrder(
  orderId: string,
  action: RunnerTransitionAction,
): Promise<RunnerOrder> {
  const backendAction = action === "at_shop" ? "at-shop" : action;
  const data = await apiSend<BackendRunnerOrder>(
    `/api/errands/orders/${encodeURIComponent(orderId)}/${backendAction}`,
    { method: "POST" },
  );
  // Normalize handles arbitrary shapes safely — no type assertion needed
  const order = normalizeRunnerOrder(data || {});
  if (!order) throw new LianApiError("跑腿后台未返回 order 数据", 0, "MALFORMED_RESPONSE");
  return order;
}

export function acceptRunnerOrder(orderId: string): Promise<RunnerOrder> {
  return transitionRunnerOrder(orderId, "accept");
}

export function markRunnerOrderAtShop(orderId: string): Promise<RunnerOrder> {
  return transitionRunnerOrder(orderId, "at_shop");
}

export function markRunnerOrderPickedUp(orderId: string): Promise<RunnerOrder> {
  return transitionRunnerOrder(orderId, "pickup");
}

export function markRunnerOrderDelivered(orderId: string): Promise<RunnerOrder> {
  return transitionRunnerOrder(orderId, "deliver");
}
