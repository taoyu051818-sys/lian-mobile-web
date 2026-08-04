/**
 * Runner-center domain types — frontend-scoped under #648.
 *
 * Why a separate file rather than `src/types/errand.ts`?
 * The shared errand contract is owned by #647. Until that lane lands the
 * cross-feature types, runner UI keeps its own narrow types so the two PRs
 * don't fight for the same import path.
 */

/**
 * Runner-side delivery state machine. The transitions are:
 *   available -> accepted (runner takes the order)
 *   accepted  -> at_shop  (runner reached the merchant pickup point)
 *   at_shop   -> picked_up (runner has the goods, en route to dropoff)
 *   picked_up -> delivered (runner handed the goods to the buyer)
 *
 * Only `available` -> `accepted` is gated by the *available pool*; the
 * remaining transitions advance the runner's own active order.
 */
export type RunnerOrderStatus =
  | "available"
  | "accepted"
  | "at_shop"
  | "picked_up"
  | "delivered"
  | "cancelled";

export type RunnerActiveStatus = Exclude<RunnerOrderStatus, "available" | "cancelled">;

export interface RunnerOrderLocation {
  label?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface RunnerOrder {
  id: string;
  status: RunnerOrderStatus;
  title: string;
  summary?: string;
  pickup?: RunnerOrderLocation;
  dropoff?: RunnerOrderLocation;
  /** Service fee charged to the requester, in points. */
  feePoints?: number;
  /** Earnings the runner will receive on delivery, in points. */
  rewardPoints?: number;
  /** Total requester balance locked for this order, in points. */
  totalLockedPoints?: number;
  distanceMeters?: number;
  /** ISO timestamp the order was created / became available. */
  createdAt?: string;
  /** ISO timestamp the order is expected to be delivered by. */
  deliverBy?: string;
  /** Free-form note from the buyer (e.g. "leave at front desk"). */
  note?: string;
}

export interface RunnerOrderListResponse {
  items: RunnerOrder[];
  total?: number;
}

export type RunnerTransitionAction = "accept" | "at_shop" | "pickup" | "deliver";

export interface RunnerTransitionResponse {
  order: RunnerOrder;
}
