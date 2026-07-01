import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "e2e" placeholder for the user-side errand order journey (issue #647).
 *
 * The repo doesn't boot Playwright/Cypress yet, so existing tests/e2e/*.spec
 * files all walk the production source as a static graph. We follow the
 * same convention here: every node along the journey must wire up to the
 * next, and a regression in any link breaks CI before it ships.
 *
 * Journey covered:
 *   1. Merchant detail "帮我取" CTA → setActiveView("errand-order")
 *   2. Form view → eligibility + auth + wallet → gate or form
 *   3. Form submit → POST /errands/orders → enterForOrder(orderId)
 *   4. Same secret view → timeline branch on the new orderId
 *   5. Gate branches: not_logged_in / not_verified / insufficient_balance /
 *      merchant_paused / no_runner_coverage / unknown
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// Step 1: detail CTA dispatches into the route singleton.

test("journey: merchant detail CTA opens the errand-order secret view", () => {
  const block = read("src/features/detail/PostDetailMerchantBlock.vue");
  expect(block).toMatch(/test-id="post-detail-merchant-errand-cta"/);
  expect(block).toMatch(/useErrandOrderRoute/);
  expect(block).toMatch(/enterForMerchant/);
  expect(block).toMatch(/setActiveView\("errand-order"\)/);
});

test("journey: errand-order is reachable as a secret view", () => {
  // The secret-view list moved from `useActiveView.ts` (which used to host
  // SECRET_VIEWS) onto the `AppViewKey` union itself + the
  // `shellLayoutModes` map in `view-types.ts`. AppViewHost still keys the
  // lazy-load table off the same name, so a regression in either side
  // breaks the journey.
  const viewTypes = read("src/app/view-types.ts");
  expect(viewTypes).toMatch(/"errand-order"/);
  expect(viewTypes).toMatch(/"errand-order":\s*"content"/);
  const host = read("src/app/AppViewHost.vue");
  expect(host).toMatch(/"errand-order":\s*asyncView/);
});

// Step 2: gate evaluator combines server eligibility + auth + wallet.

test("journey: gate composable pulls auth/me + wallet + eligibility together", () => {
  const draft = read("src/features/errand/useErrandOrderDraft.ts");
  expect(draft).toMatch(/Promise\.all/);
  expect(draft).toMatch(/fetchAuthMe/);
  expect(draft).toMatch(/fetchProfileWallet/);
  expect(draft).toMatch(/fetchErrandOrderEligibility/);
});

test("journey: each gate reason has a localized fallback string", () => {
  const format = read("src/features/errand/errand-format.ts");
  for (const reason of [
    "not_logged_in",
    "not_verified",
    "insufficient_balance",
    "merchant_paused",
    "no_runner_coverage",
    "unknown",
  ]) {
    expect(format).toMatch(new RegExp(`case "${reason}"`));
  }
});

// Step 3: submit posts and pivots into timeline mode.

test("journey: form submit creates an order and enters timeline mode", () => {
  const view = read("src/features/errand/ErrandOrderView.vue");
  expect(view).toMatch(/handleSubmit/);
  expect(view).toMatch(/enterForOrder/);

  const draft = read("src/features/errand/useErrandOrderDraft.ts");
  expect(draft).toMatch(/createErrandOrder/);
  // Failure case must fold into the gate so the same blocked-state UI shows.
  expect(draft).toMatch(/gate\.value\s*=\s*\{/);
});

// Step 4: timeline view renders the order detail.

test("journey: timeline view loads the order detail on mount", () => {
  const view = read("src/features/errand/ErrandOrderTimelineView.vue");
  expect(view).toMatch(/onMounted/);
  expect(view).toMatch(/useErrandOrderDetail/);
  expect(view).toMatch(/data-testid="errand-order-timeline-list"/);
});

test("journey: same view key flips between form and timeline branches", () => {
  const view = read("src/features/errand/ErrandOrderView.vue");
  // The route singleton supplies the orderId; the view branches on it.
  expect(view).toMatch(/isTimelineMode/);
  expect(view).toMatch(/route\.orderId\.value/);
});

// Step 5: API contract — we collapse unknown gate codes; we don't trust the wire.

test("journey: api normalizer hardens the gate against unknown codes", () => {
  const api = read("src/api/errands.ts");
  expect(api).toMatch(/export function normalizeErrandOrderGate/);
  expect(api).toMatch(/GATE_REASON_CODES\.has/);
});
