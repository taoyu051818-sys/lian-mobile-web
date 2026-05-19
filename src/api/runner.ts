import { apiGet, apiSend } from "./http";
import type {
  RunnerOrder,
  RunnerOrderListResponse,
  RunnerTransitionAction,
  RunnerTransitionResponse,
} from "../types/runner";

/**
 * Available pool — orders not yet claimed by any runner.
 */
export async function fetchAvailableRunnerOrders(): Promise<RunnerOrderListResponse> {
  const data = await apiGet<{ items?: RunnerOrder[]; total?: number }>(
    "/api/runner/orders/available",
  );
  return { items: data.items || [], total: data.total ?? data.items?.length ?? 0 };
}

/**
 * Orders the current runner has accepted but not yet delivered.
 */
export async function fetchActiveRunnerOrders(): Promise<RunnerOrderListResponse> {
  const data = await apiGet<{ items?: RunnerOrder[]; total?: number }>("/api/runner/orders/active");
  return { items: data.items || [], total: data.total ?? data.items?.length ?? 0 };
}

async function transitionRunnerOrder(
  orderId: string,
  action: RunnerTransitionAction,
): Promise<RunnerOrder> {
  const data = await apiSend<RunnerTransitionResponse>(
    `/api/runner/orders/${encodeURIComponent(orderId)}/${action}`,
    { method: "POST" },
  );
  if (!data.order) throw new Error("跑腿后台未返回 order 数据");
  return data.order;
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
