/**
 * Errand (campus delivery) fixtures.
 *
 * Contract notes from `src/api/errands.ts`:
 * - `normalizeErrandOrder` returns null unless BOTH `pickupLocation` and
 *   `dropoffLocation` normalize, and each needs a `placeId` or `label`. A
 *   fixture missing those silently renders as "no order".
 * - Money stays in points (`feePoints` / `rewardPoints` / `totalLockedPoints`),
 *   never RMB — errand orders and commerce payments are separate models.
 * - The eligibility gate has a fixed reason vocabulary; anything else collapses
 *   to `unknown`, so the identity-driven gates below use only real codes.
 */

import { fixtureJson, fixtureNotFound } from "../contract";
import { registerFixtureFamily } from "../registry";
import type { FixtureIdentity, FixtureRequestContext, FixtureScenario } from "../types";
import { claimErrandOrder, isErrandOrderClaimed } from "../writes";
import { area, identityProfile, itemCount, timestampFor } from "./support";

const FAMILY = "errands";

/** Progression of a real order so the timeline view has something to show. */
const STATUS_FLOW = [
  "created",
  "paid_locked",
  "assigned",
  "at_shop",
  "picked_up",
  "delivering",
  "delivered",
  "completed",
] as const;

function location(index: number, kind: "pickup" | "dropoff") {
  const offset = kind === "pickup" ? 0 : 3;
  return {
    placeId: `place-${kind}-${(index + offset) % 8}`,
    label: area(index + offset),
    lat: 31.23 + index * 0.0015,
    lng: 121.47 + index * 0.0012,
  };
}

function orderIdFor(index: number): string {
  return `errand-${String(index + 1).padStart(4, "0")}`;
}

function buildOrder(index: number, scenario: FixtureScenario, statusIndex?: number) {
  const status = STATUS_FLOW[(statusIndex ?? index) % STATUS_FLOW.length] ?? "created";
  const assigned = STATUS_FLOW.indexOf(status) >= 2;
  return {
    orderId: orderIdFor(index),
    requesterUserId: "u-fixture-self",
    ...(assigned ? { runnerUserId: `u-runner-${index % 4}` } : {}),
    merchantPostId: 52_000 + index,
    pickupLocation: location(index, "pickup"),
    dropoffLocation: location(index, "dropoff"),
    mode: index % 5 === 0 ? "meal_peak_batch" : "dedicated",
    status,
    // Points, not RMB.
    feePoints: 300 + (index % 6) * 50,
    rewardPoints: 120 + (index % 4) * 30,
    totalLockedPoints: 420 + (index % 6) * 50,
    ...(assigned && status !== "completed" ? { etaSeconds: 480 + index * 45 } : {}),
    notes: scenario === "partial-data" && index % 2 === 0 ? "" : "麻烦放在宿舍楼下前台，谢谢。",
    createdAt: timestampFor(index),
  };
}

/** Timeline entries up to the order's current status. */
function buildTimeline(index: number, scenario: FixtureScenario) {
  const order = buildOrder(index, scenario);
  const upTo = STATUS_FLOW.indexOf(order.status as (typeof STATUS_FLOW)[number]);
  return STATUS_FLOW.slice(0, Math.max(1, upTo + 1)).map((status, step) => ({
    status,
    at: timestampFor(index + step),
    actor: step === 0 ? "requester" : status === "completed" ? "platform" : "runner",
  }));
}

function orderDetail(index: number, scenario: FixtureScenario) {
  const order = buildOrder(index, scenario);
  return {
    order,
    timeline: buildTimeline(index, scenario),
    notes: order.notes,
    createdAt: order.createdAt,
  };
}

function orderCount(scenario: FixtureScenario): number {
  if (scenario === "empty") return 0;
  if (scenario === "many-items") return 12;
  return 4;
}

/**
 * Identity-driven eligibility gate using only the documented reason codes.
 * This is what makes the "not verified" / "guest" empty states reachable.
 */
function gateFor(identity: FixtureIdentity, scenario: FixtureScenario) {
  if (identity === "guest") {
    return { ok: false, reason: "not_logged_in", reasonText: "请先登录后再下单" };
  }
  if (!identityProfile(identity).tags.includes("campus_verified")) {
    return { ok: false, reason: "not_verified", reasonText: "完成校园认证后即可使用跑腿服务" };
  }
  if (scenario === "partial-data") {
    return { ok: false, reason: "insufficient_balance", reasonText: "积分余额不足，请先充值" };
  }
  if (scenario === "empty") {
    return { ok: false, reason: "no_runner_coverage", reasonText: "当前区域暂无跑腿骑手" };
  }
  return { ok: true, reason: "", reasonText: "" };
}

function resolveIndex(raw: string, scenario: FixtureScenario): number | null {
  const match = /^errand-(\d+)$/.exec(raw);
  const index = match ? Number(match[1]) - 1 : Number(raw) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= orderCount(scenario)) return null;
  return index;
}

export function registerErrandFixtures(): void {
  registerFixtureFamily(FAMILY, [
    [
      "GET",
      "/api/errands/orders/eligibility",
      ({ identity, scenario }: FixtureRequestContext) => fixtureJson(gateFor(identity, scenario)),
    ],
    [
      "GET",
      "/api/errands/orders/mine",
      ({ scenario, volume, query }: FixtureRequestContext) => {
        const total = Math.min(orderCount(scenario), itemCount(scenario, volume));
        const runnerView = query.get("role") === "runner";
        const items = Array.from({ length: total }, (_, index) => {
          const order = buildOrder(index, scenario, runnerView ? index + 2 : index);
          return {
            orderId: order.orderId,
            status: order.status,
            mode: order.mode,
            feePoints: order.feePoints,
            pickupLocation: order.pickupLocation,
            dropoffLocation: order.dropoffLocation,
            createdAt: order.createdAt,
          };
        });
        return fixtureJson({ items });
      },
    ],
    [
      "GET",
      "/api/errands/orders/available",
      ({ scenario, identity }: FixtureRequestContext) => {
        // Only runners see the open pool; everyone else gets the real 403.
        if (!identityProfile(identity).tags.includes("runner")) {
          return fixtureJson(
            { error: "仅认证骑手可查看可接订单", code: "FIXTURE_RUNNER_REQUIRED" },
            403,
          );
        }
        const total = orderCount(scenario);
        const items = Array.from({ length: total }, (_, index) => index)
          .filter((index) => !isErrandOrderClaimed(orderIdFor(index)))
          .map((index) => {
            const order = buildOrder(index, scenario, 1);
            return {
              orderId: order.orderId,
              status: "paid_locked",
              mode: order.mode,
              feePoints: order.feePoints,
              rewardPoints: order.rewardPoints,
              pickupLocation: order.pickupLocation,
              dropoffLocation: order.dropoffLocation,
              createdAt: order.createdAt,
            };
          });
        return fixtureJson({ items });
      },
    ],
    [
      "POST",
      "/api/errands/orders",
      ({ identity, scenario, body }: FixtureRequestContext) => {
        const gate = gateFor(identity, scenario);
        // A blocked gate must fail the create call too, not just hide the button.
        if (!gate.ok) return fixtureJson(gate, 200);
        const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
        const detail = orderDetail(0, scenario);
        return fixtureJson({
          ok: true,
          ...detail,
          order: {
            ...detail.order,
            status: "created",
            ...(typeof payload.mode === "string" ? { mode: payload.mode } : {}),
          },
        });
      },
    ],
    [
      "GET",
      "/api/errands/orders/:orderId",
      ({ scenario, params }: FixtureRequestContext) => {
        const index = resolveIndex(params.orderId ?? "", scenario);
        if (index === null) return fixtureNotFound("订单不存在或已被取消");
        return fixtureJson(orderDetail(index, scenario));
      },
    ],
    [
      "POST",
      "/api/errands/orders/:orderId/cancel",
      ({ scenario, params }: FixtureRequestContext) => {
        const index = resolveIndex(params.orderId ?? "", scenario);
        if (index === null) return fixtureNotFound("订单不存在或已被取消");
        const detail = orderDetail(index, scenario);
        return fixtureJson({
          ok: true,
          ...detail,
          order: { ...detail.order, status: "cancelled" },
          timeline: [
            ...detail.timeline,
            { status: "cancelled", at: timestampFor(index), actor: "requester" },
          ],
        });
      },
    ],
    [
      "POST",
      "/api/errands/orders/:orderId/claim",
      ({ scenario, params }: FixtureRequestContext) => {
        const index = resolveIndex(params.orderId ?? "", scenario);
        if (index === null) return fixtureNotFound("订单不存在或已被取消");
        claimErrandOrder(orderIdFor(index));
        const detail = orderDetail(index, scenario);
        return fixtureJson({
          ok: true,
          ...detail,
          order: { ...detail.order, status: "assigned", runnerUserId: "u-fixture-self" },
        });
      },
    ],
  ]);
}
