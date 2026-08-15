/**
 * Profile fixtures: stats, wallet, rewards ledger, settings, and the shared
 * activity-list surface (posts / replies / saved / liked / drafts / history /
 * map contributions), all shaped by `src/types/profile.ts`.
 *
 * Settings are the one genuinely stateful surface here: PATCH persists into the
 * in-memory write store so the optimistic-update-then-confirm path in
 * settings-state behaves like it does against the real backend.
 */

import { fixtureJson } from "../contract";
import { registerFixtureFamily } from "../registry";
import type { FixtureRequestContext, FixtureScenario, FixtureVolume } from "../types";
import { getSettings, mergeSettings } from "../writes";
import {
  area,
  countFor,
  identityProfile,
  isMerchant,
  isPartial,
  itemCount,
  localCover,
  postTitle,
  timeLabelFor,
  timestampFor,
} from "./support";

const FAMILY = "profile";

const STATUSES = ["active", "resolved", "expired"] as const;
const VISIBILITIES = ["public", "campus", "private"] as const;

function activityItems(scenario: FixtureScenario, volume: FixtureVolume) {
  const count = itemCount(scenario, volume);
  return Array.from({ length: count }, (_, index) => {
    const partial = isPartial(scenario, index);
    return {
      tid: 41_000 + index,
      id: `activity-${index}`,
      title: postTitle(index, scenario),
      // `partial-data` drops the optional cover/area so the fallback UI renders.
      cover: partial ? undefined : localCover(index),
      timestampISO: timestampFor(index),
      timeLabel: timeLabelFor(index),
      locationArea: partial ? undefined : area(index),
      status: STATUSES[index % STATUSES.length],
      visibility: VISIBILITIES[index % VISIBILITIES.length],
    };
  });
}

/** Every `/api/me/*` activity list shares one response shape: `{ items }`. */
function activityHandler() {
  return ({ scenario, volume }: FixtureRequestContext) =>
    fixtureJson({ items: activityItems(scenario, volume) });
}

export function registerProfileFixtures(): void {
  registerFixtureFamily(FAMILY, [
    [
      "GET",
      "/api/me/stats",
      ({ scenario }: FixtureRequestContext) => {
        // `empty` is a brand-new account: every counter legitimately zero.
        const zero = scenario === "empty";
        return fixtureJson({
          posts: zero ? 0 : countFor(3, scenario),
          replies: zero ? 0 : countFor(5, scenario),
          saved: zero ? 0 : countFor(7, scenario),
          liked: zero ? 0 : countFor(9, scenario),
          drafts: zero ? 0 : countFor(2, scenario),
          mapContributions: zero ? 0 : countFor(4, scenario),
        });
      },
    ],
    [
      "GET",
      "/api/wallet/me",
      ({ scenario }: FixtureRequestContext) =>
        fixtureJson({
          points: scenario === "empty" ? 0 : countFor(11, scenario),
          honor: scenario === "empty" ? 0 : countFor(6, scenario),
          lockedPoints: scenario === "empty" ? 0 : 120,
        }),
    ],
    [
      "GET",
      "/api/me/rewards",
      ({ scenario, volume }: FixtureRequestContext) => {
        // The deferred lifecycle is a real backend state the UI must render.
        if (scenario === "partial-data") {
          return fixtureJson({ ok: true, lifecycle: "deferred", reason: "积分系统正在结算中" });
        }
        const count = scenario === "empty" ? 0 : Math.min(itemCount(scenario, volume), 24);
        let balance = 1_280;
        const entries = Array.from({ length: count }, (_, index) => {
          const delta = index % 3 === 0 ? -(20 + index) : 30 + index * 3;
          balance += delta;
          return {
            id: `ledger-${index}`,
            currency: index % 4 === 0 ? ("honor" as const) : ("points" as const),
            delta,
            balanceAfter: Math.max(0, balance),
            creditedBy: (["platform", "topup", "reward", "task"] as const)[index % 4] ?? "platform",
            ref: index % 2 === 0 ? `order-${index}` : null,
            at: timestampFor(index),
          };
        });
        return fixtureJson({
          ok: true,
          lifecycle: "active",
          balances: { points: 1_280, honor: 96, lockedPoints: 120 },
          totals: { pointsEarned: 3_640, honorEarned: 210 },
          entries,
        });
      },
    ],
    ["GET", "/api/me/settings", () => fixtureJson(getSettings())],
    [
      "PATCH",
      "/api/me/settings",
      ({ body }: FixtureRequestContext) =>
        fixtureJson(
          mergeSettings(
            body && typeof body === "object" ? (body as Record<string, unknown>) : {},
          ),
        ),
    ],
    ["GET", "/api/me/posts", activityHandler()],
    ["GET", "/api/me/replies", activityHandler()],
    ["GET", "/api/me/saved", activityHandler()],
    ["GET", "/api/me/liked", activityHandler()],
    ["GET", "/api/me/drafts", activityHandler()],
    ["GET", "/api/me/history", activityHandler()],
    ["GET", "/api/me/map-contributions", activityHandler()],
    [
      "GET",
      "/api/me/merchant-center",
      ({ identity, scenario }: FixtureRequestContext) => {
        // Merchant center is gated: non-merchants must see the real 403 path.
        if (!isMerchant(identity)) {
          return fixtureJson(
            { error: "需要商家认证后才能访问", code: "FIXTURE_MERCHANT_REQUIRED" },
            403,
          );
        }
        return fixtureJson({
          ok: true,
          storeId: "1",
          pendingOrders: scenario === "empty" ? 0 : 4,
          todaySales: scenario === "empty" ? 0 : 1_860,
          items: activityItems(scenario, "sparse"),
        });
      },
    ],
  ]);
}
