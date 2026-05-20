import { apiGet, apiSend } from "./http";
import type {
  RunnerOrder,
  RunnerOrderListResponse,
  RunnerTransitionAction,
  RunnerTransitionResponse,
} from "../types/runner";

type BackendRunnerOrder = Partial<RunnerOrder> & {
  order?: BackendRunnerOrder;
  orderId?: string;
  state?: string;
  pickupLocation?: { label?: string; address?: string; lat?: number; lng?: number };
  dropoffLocation?: { label?: string; address?: string; lat?: number; lng?: number };
  feeAmount?: number;
  rewardAmount?: number;
  createdAt?: string;
  notes?: string;
};

function normalizeRunnerStatus(value: unknown): RunnerOrder["status"] {
  if (value === "paid_locked" || value === "created") return "available";
  if (value === "assigned") return "accepted";
  if (value === "delivering") return "picked_up";
  if (value === "picked_up" || value === "delivered" || value === "cancelled") return value;
  return "available";
}

function normalizeRunnerOrder(value: BackendRunnerOrder): RunnerOrder | null {
  const source = value.order || value;
  const id = String(source.id || source.orderId || "");
  if (!id) return null;
  return {
    id,
    status: normalizeRunnerStatus(source.status || source.state),
    title: String(source.title || source.summary || id),
    summary: source.summary,
    pickup: source.pickup || source.pickupLocation,
    dropoff: source.dropoff || source.dropoffLocation,
    rewardFen: source.rewardFen ?? source.rewardAmount,
    createdAt: source.createdAt,
    note: source.note || source.notes,
  };
}

function normalizeRunnerOrderList(data: {
  items?: BackendRunnerOrder[];
  total?: number;
}): RunnerOrderListResponse {
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
  const data = await apiGet<{ items?: BackendRunnerOrder[]; total?: number }>(
    "/api/errands/orders/mine?role=runner&state=paid_locked",
  );
  return normalizeRunnerOrderList(data);
}

/**
 * Orders the current runner has accepted but not yet delivered.
 */
export async function fetchActiveRunnerOrders(): Promise<RunnerOrderListResponse> {
  const data = await apiGet<{ items?: BackendRunnerOrder[]; total?: number }>(
    "/api/errands/orders/mine?role=runner",
  );
  return normalizeRunnerOrderList(data);
}

async function transitionRunnerOrder(
  orderId: string,
  action: RunnerTransitionAction,
): Promise<RunnerOrder> {
  const backendAction = action === "at_shop" ? "pickup" : action;
  const data = await apiSend<RunnerTransitionResponse | BackendRunnerOrder>(
    `/api/errands/orders/${encodeURIComponent(orderId)}/${backendAction}`,
    { method: "POST" },
  );
  const order = normalizeRunnerOrder(data as BackendRunnerOrder);
  if (!order) throw new Error("跑腿后台未返回 order 数据");
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
