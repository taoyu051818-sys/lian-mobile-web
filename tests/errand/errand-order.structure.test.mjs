import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Errand-order structure tests (issue #647). Walks the static graph that
 * backs the user-side order journey: detail-page CTA → secret view → form
 * → gate / submit → timeline view. We do not boot Vue here — these are
 * grep-style assertions that catch the most common drift (rename, deleted
 * testid, broken import) before any vitest run.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- view registration ---

test("errand-order is registered as an AppViewKey", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /"errand-order"/);
  assert.match(src, /"errand-order":\s*"content"/);
});

test("errand-order does not appear in the bottom-tab appViews array", () => {
  const src = read("src/app/view-types.ts");
  const arrayMatch = src.match(
    /export const appViews:\s*AppViewDefinition\[\]\s*=\s*\[(?<body>[\s\S]*?)\];/,
  );
  assert.ok(arrayMatch, "appViews array must exist");
  assert.doesNotMatch(arrayMatch.groups.body, /key:\s*"errand-order"/);
});

test("AppViewHost lazy-loads ErrandOrderView", () => {
  const src = read("src/app/AppViewHost.vue");
  assert.match(src, /"errand-order":\s*asyncView/);
  assert.match(src, /\.\.\/features\/errand/);
  assert.match(src, /ErrandOrderView/);
});

test("useActiveView accepts secret view 'errand-order'", () => {
  const src = read("src/app/useActiveView.ts");
  assert.match(src, /getViewFromHashRef/);
  assert.match(src, /pushViewHash\(key\)/);
  assert.match(src, /secret views \(admin\/verification\/merchant\/errand-order\/runner\)/);
});

// --- types ---

test("errand types module owns the request/draft/gate/timeline shapes", () => {
  const src = read("src/types/errand.ts");
  assert.match(src, /export interface ErrandOrderDraft/);
  assert.match(src, /export interface ErrandOrderRequest/);
  assert.match(src, /export interface ErrandOrderGate/);
  assert.match(src, /export interface ErrandOrderTimelineEvent/);
  assert.match(src, /export interface ErrandOrderDetail/);
  assert.match(src, /export interface ErrandOrderCreateResponse/);
  // Re-exports the lifecycle shapes from post-extensions so #648 can import
  // everything from one place.
  assert.match(src, /export type \{[\s\S]*ErrandOrder[\s\S]*\}\s*from\s*"\.\/post-extensions"/);
});

test("ErrandOrderGateReason union covers the documented codes", () => {
  const src = read("src/types/errand.ts");
  for (const code of [
    "not_logged_in",
    "not_verified",
    "insufficient_balance",
    "merchant_paused",
    "no_runner_coverage",
    "unknown",
  ]) {
    assert.match(src, new RegExp(`"${code}"`));
  }
});

// --- API ---

test("api/errands.ts exposes the order endpoints + normalizers", () => {
  const src = read("src/api/errands.ts");
  assert.match(src, /\/api\/errands\/orders/);
  assert.match(src, /export async function fetchErrandOrderEligibility/);
  assert.match(src, /export async function createErrandOrder/);
  assert.match(src, /export async function fetchErrandOrder/);
  assert.match(src, /export function normalizeErrandOrderGate/);
  assert.match(src, /export function normalizeErrandOrderDetail/);
  assert.match(src, /GATE_REASON_CODES/);
});

test("api/errands.ts collapses unknown reason codes to the 'unknown' sentinel", () => {
  const src = read("src/api/errands.ts");
  // Cheap structural check: the module must reference "unknown" twice — once
  // in the code-set, once in the fallback dispatch — so an accidental rename
  // of the sentinel breaks here.
  const matches = src.match(/"unknown"/g) || [];
  assert.ok(matches.length >= 2, `expected >=2 references to "unknown"; saw ${matches.length}`);
});

// --- composables ---

test("useErrandOrderDraft owns gate + submit + reset", () => {
  const src = read("src/features/errand/useErrandOrderDraft.ts");
  assert.match(src, /export function useErrandOrderDraft/);
  assert.match(src, /fetchErrandOrderEligibility/);
  assert.match(src, /fetchAuthMe/);
  assert.match(src, /fetchProfileWallet/);
  assert.match(src, /createErrandOrder/);
  // Local gate evaluator must run BEFORE the server gate — otherwise an
  // anonymous user would always see the server's auth-rejected error
  // instead of our localized copy.
  assert.match(src, /deriveLocalGate/);
});

test("useErrandOrderDetail owns the read-side fetch", () => {
  const src = read("src/features/errand/useErrandOrderDetail.ts");
  assert.match(src, /export function useErrandOrderDetail/);
  assert.match(src, /fetchErrandOrder/);
  // Polling lifecycle is exposed so the timeline view can drive it from
  // mount/unmount — start/stop must be there or the view leaks a timer.
  assert.match(src, /function start/);
  assert.match(src, /function stop/);
  assert.match(src, /isTerminalErrandStatus/);
});

test("isTerminalErrandStatus only blesses the truly-terminal codes", () => {
  const src = read("src/features/errand/errand-format.ts");
  assert.match(src, /isTerminalErrandStatus/);
  // Cheap structural guard: the terminal set must include delivered /
  // cancelled / refunded but must NOT include disputed (a dispute can still
  // resolve to delivered or refunded).
  const setMatch = src.match(
    /TERMINAL_ERRAND_STATUSES\s*=\s*new Set<ErrandStatus>\(\[(?<body>[\s\S]*?)\]\)/,
  );
  assert.ok(setMatch, "TERMINAL_ERRAND_STATUSES must be defined");
  for (const code of ["delivered", "cancelled", "refunded"]) {
    assert.match(setMatch.groups.body, new RegExp(`"${code}"`));
  }
  assert.doesNotMatch(setMatch.groups.body, /"disputed"/);
});

test("api/errands.ts ships the my-orders fetch", () => {
  const src = read("src/api/errands.ts");
  assert.match(src, /export async function fetchMyErrandOrders/);
  assert.match(src, /\/api\/errands\/orders\/mine/);
});

test("useMyErrandOrders is a thin wrapper over fetchMyErrandOrders", () => {
  const src = read("src/features/errand/useMyErrandOrders.ts");
  assert.match(src, /export function useMyErrandOrders/);
  assert.match(src, /fetchMyErrandOrders/);
});

test("ProfileErrandOrdersBlock dispatches taps into the route singleton", () => {
  const src = read("src/features/errand/ProfileErrandOrdersBlock.vue");
  assert.match(src, /data-testid="profile-errand-orders"/);
  assert.match(src, /data-testid="profile-errand-orders-list"/);
  assert.match(src, /data-testid="profile-errand-orders-open"/);
  assert.match(src, /useErrandOrderRoute/);
  assert.match(src, /enterForOrder/);
  assert.match(src, /setActiveView\("errand-order"\)/);
});

test("ProfileView mounts the my-orders block via the errand barrel", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /ProfileErrandOrdersBlock/);
  // Must come from the errand barrel, not a deep import — the barrel
  // export is the public surface.
  assert.match(src, /from\s+"\.\.\/errand"/);
});

// --- issue #609 PR1: orders tab promotion + cancel + V0.2 placeholder ---

test("issue #609 PR1: ProfileTabKey union includes 'orders'", () => {
  const src = read("src/types/profile.ts");
  assert.match(src, /\|\s*"orders"/);
});

test("issue #609 PR1: useProfileTabs registers the orders tab + short-circuits its load", () => {
  const src = read("src/features/profile/useProfileTabs.ts");
  assert.match(src, /PROFILE_TAB_ORDERS/);
  assert.match(src, /key:\s*"orders"/);
  // Orders tab must NOT call /api/profile/orders (does not exist) — short-
  // circuiting preserves listEmptyText flow without 404-spamming the backend.
  assert.match(src, /tab\s*===\s*"orders"/);
});

test("issue #609 PR1: ProfileView routes the orders tab into ProfileErrandOrdersBlock", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /<ProfileErrandOrdersBlock\s+v-if="activeTab === 'orders'"/);
  // The previous (buggy) gating mounted the block as a runner-gated footer —
  // requesters are not necessarily runners, so the footer mount must be gone.
  assert.doesNotMatch(src, /<ProfileErrandOrdersBlock\s+v-if="isRunnerVerified"/);
});

test("issue #609 PR1: ProfileErrandOrdersBlock renders the two-line empty state", () => {
  const src = read("src/features/errand/ProfileErrandOrdersBlock.vue");
  assert.match(src, /ORDERS_LIST_EMPTY_HEADLINE/);
  assert.match(src, /ORDERS_LIST_EMPTY_HINT/);
  assert.match(src, /data-testid="profile-errand-orders-empty"/);
  // Must reference brand keys (not inline literals) so the brand.test guard
  // catches drift; PR #746 convention.
  assert.match(src, /profile-errand-orders__empty-headline/);
  assert.match(src, /profile-errand-orders__empty-hint/);
});

test("issue #609 PR1: api/errands.ts ships cancelErrandOrder against the live route", () => {
  const src = read("src/api/errands.ts");
  assert.match(src, /export async function cancelErrandOrder/);
  // Must hit the cancel route, NOT assign or runner-location (those are 501).
  assert.match(src, /\/cancel/);
  assert.doesNotMatch(src, /\/assign/);
  assert.doesNotMatch(src, /\/runner-location/);
});

test("issue #609 PR1: useErrandOrderDetail exposes cancel + canCancel + cancelError", () => {
  const src = read("src/features/errand/useErrandOrderDetail.ts");
  assert.match(src, /cancelErrandOrder/);
  assert.match(src, /async function cancel/);
  assert.match(src, /canCancel/);
  assert.match(src, /cancelError/);
  // canCancel must dispatch off `isTerminalErrandStatus` so terminal orders
  // never expose the CTA.
  assert.match(src, /isTerminalErrandStatus/);
});

test("issue #609 PR1: ErrandOrderTimelineView renders cancel + V0.2 runner-location", () => {
  const src = read("src/features/errand/ErrandOrderTimelineView.vue");
  // Cancel CTA only when canCancel — terminal states must not surface it.
  assert.match(src, /data-testid="errand-order-timeline-cancel"/);
  assert.match(src, /v-if="canCancel"/);
  assert.match(src, /ORDERS_CANCEL_CTA/);
  assert.match(src, /ORDERS_CANCEL_CONFIRM/);
  // V0.2 placeholder panel — labeled deferred, never fetches the 501 route.
  assert.match(src, /data-testid="errand-order-timeline-runner-location"/);
  assert.match(src, /ORDERS_RUNNER_LOCATION_DEFERRED/);
});

test("issue #609 PR1: ORDERS_* brand strings exist and map to documented keys", () => {
  const src = read("src/config/brand/merchant.ts");
  for (const key of [
    "PROFILE_TAB_ORDERS",
    "ORDERS_LIST_EMPTY_HEADLINE",
    "ORDERS_LIST_EMPTY_HINT",
    "ORDERS_TIMELINE_LABEL",
    "ORDERS_CANCEL_CTA",
    "ORDERS_CANCEL_CONFIRM",
    "ORDERS_CANCEL_PENDING",
    "ORDERS_CANCEL_FAILED",
    "ORDERS_RUNNER_LOCATION_TITLE",
    "ORDERS_RUNNER_LOCATION_DEFERRED",
    "ORDERS_RUNNER_LOCATION_DEFERRED_HINT",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`));
  }
});

test("useErrandOrderRoute is a singleton route store", () => {
  const src = read("src/features/errand/useErrandOrderRoute.ts");
  assert.match(src, /enterForMerchant/);
  assert.match(src, /enterForOrder/);
  // Setting one mode must clear the other (otherwise both branches render).
  assert.match(src, /merchantPostId\.value\s*=\s*null/);
  assert.match(src, /orderId\.value\s*=\s*""/);
  // Origin tracking lets close/back handlers return the user to the surface
  // they came from instead of dumping everyone on feed.
  assert.match(src, /origin/);
  assert.match(src, /AppViewKey/);
});

// --- view branches ---

test("ErrandOrderView surfaces the gate, form, and submit affordances", () => {
  const src = read("src/features/errand/ErrandOrderView.vue");
  assert.match(src, /data-testid="errand-order-view"/);
  assert.match(src, /data-testid="errand-order-form"/);
  assert.match(src, /data-testid="errand-order-pickup-input"/);
  assert.match(src, /data-testid="errand-order-dropoff-input"/);
  assert.match(src, /data-testid="errand-order-notes-input"/);
  assert.match(src, /data-testid="errand-order-submit"/);
  assert.match(src, /ErrandOrderGate/);
  assert.match(src, /ErrandOrderTimelineView/);
  // Submit must dispatch through the route singleton — otherwise the
  // post-submit view does not pivot into timeline mode.
  assert.match(src, /enterForOrder/);
  // Close/back hands the user back to the origin surface (issue #647 review
  // A1) instead of always routing to feed.
  assert.match(src, /route\.origin\.value/);
  // goLogin must NOT route to feed — auth lives on the profile tab.
  assert.doesNotMatch(src, /function goLogin\(\)\s*\{[^}]*setActiveView\("feed"\)/);
  // Module-scope route singleton must reset on unmount so a tab-bar switch
  // doesn't leak merchantPostId/orderId across remounts (review A3).
  assert.match(src, /onBeforeUnmount/);
});

test("ErrandOrderGate exposes the four gate CTAs", () => {
  const src = read("src/features/errand/ErrandOrderGate.vue");
  assert.match(src, /data-testid="errand-order-gate"/);
  assert.match(src, /data-testid="errand-order-gate-cta"/);
  assert.match(src, /goLogin/);
  assert.match(src, /goVerify/);
  assert.match(src, /goWallet/);
});

test("ErrandOrderTimelineView lists timeline events + pickup/dropoff", () => {
  const src = read("src/features/errand/ErrandOrderTimelineView.vue");
  assert.match(src, /data-testid="errand-order-timeline-view"/);
  assert.match(src, /data-testid="errand-order-timeline-list"/);
  assert.match(src, /data-testid="errand-order-timeline-entry"/);
  assert.match(src, /data-testid="errand-order-timeline-pickup"/);
  assert.match(src, /data-testid="errand-order-timeline-dropoff"/);
  // Error branch must offer a manual retry — without it polling+initial
  // fetch failures leave the user stuck on an alert with nothing to do
  // (review A4).
  assert.match(src, /data-testid="errand-order-timeline-retry"/);
});

// --- merchant detail wiring (CTA dispatch) ---

test("PostDetailMerchantBlock dispatches the errand CTA into the route singleton", () => {
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /data-testid="post-detail-merchant-errand-cta"/);
  assert.match(src, /useErrandOrderRoute/);
  assert.match(src, /enterForMerchant/);
  assert.match(src, /setActiveView\("errand-order"\)/);
});

// --- brand strings registered ---

test("errand brand strings are registered", () => {
  const src = read("src/config/brand/merchant.ts");
  for (const key of [
    "ERRAND_ORDER_SECTION_LABEL",
    "ERRAND_ORDER_PICKUP_TITLE",
    "ERRAND_ORDER_DROPOFF_TITLE",
    "ERRAND_ORDER_NOTES_TITLE",
    "ERRAND_ORDER_MODE_DEDICATED",
    "ERRAND_ORDER_MODE_BATCH",
    "ERRAND_ORDER_GATE_NOT_LOGGED_IN",
    "ERRAND_ORDER_GATE_NOT_VERIFIED",
    "ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE",
    "ERRAND_ORDER_GATE_MERCHANT_PAUSED",
    "ERRAND_ORDER_GATE_NO_RUNNER_COVERAGE",
    "ERRAND_ORDER_DETAIL_TIMELINE",
    "ERRAND_ORDER_STATUS_CREATED",
    "ERRAND_ORDER_STATUS_DELIVERED",
    "ERRAND_ORDER_SUBMIT",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`));
  }
});
