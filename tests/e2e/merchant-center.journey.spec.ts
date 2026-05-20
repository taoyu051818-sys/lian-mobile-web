import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "e2e" placeholder for the merchant center journey (issue #646).
 *
 * The repo doesn't have a Playwright/Cypress harness yet — every existing
 * `tests/e2e/*` would be a structure check on the production source. We
 * follow the same convention here: walk the static graph that backs the
 * verified-vs-gate journey and assert the wiring is intact, so a regression
 * in any of these files breaks CI before it ships.
 *
 * Journey covered:
 *   1. Profile entry → setActiveView("merchant"), gated on merchant_verified
 *   2. Verified user → /api/me/merchant-center → profile + errand readout
 *   3. Unverified user → gate → verification center
 *   4. Merchant detail page → errand entry available / unavailable+reason
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// Step 1: secret view is reachable from useActiveView, lazily mounted, and
// the ProfileView surfaces the entry behind a `merchant_verified` gate.

test("journey: merchant secret view is reachable from useActiveView", () => {
  // After PR #676, useActiveView no longer keeps a SECRET_VIEWS allowlist —
  // viewFromHash is the single source of truth and accepts the full
  // AppViewKey union. Pin the type-level guarantee instead.
  const viewTypes = read("src/app/view-types.ts");
  assert.match(viewTypes, /export type AppViewKey/);
  assert.match(viewTypes, /"merchant"/);
});

test("journey: AppViewHost lazy-loads MerchantCenterView", () => {
  const host = read("src/app/AppViewHost.vue");
  assert.match(host, /merchant:\s*asyncView\(\(\)\s*=>\s*import\("\.\.\/features\/merchant"\)/);
});

test("journey: ProfileView surfaces the merchant-center entry behind merchant_verified", () => {
  const view = read("src/features/profile/ProfileView.vue");
  assert.match(view, /useIsMerchantVerified/);
  assert.match(view, /data-testid="profile-merchant-entry"/);
  assert.match(view, /v-if="isMerchantVerified"/);
  assert.match(view, /setActiveView\('merchant'\)/);
});

// Step 2: verified user → snapshot shape supplies profile + errand block.

test("journey: verified user receives profile + errand snapshot", () => {
  const types = read("src/types/merchant.ts");
  assert.match(types, /MerchantCenterSnapshot/);
  assert.match(types, /profile:\s*MerchantProfileSummary\s*\|\s*null/);
  assert.match(types, /errand:\s*MerchantErrandEligibility/);

  const view = read("src/features/merchant/MerchantCenterView.vue");
  // Profile rows render only when merchantVerified is true.
  assert.match(view, /data-testid="merchant-center-profile"/);
  assert.match(view, /data-testid="merchant-center-errand"/);
});

// Step 3: unverified user → gate → verification center.

test("journey: unverified user lands on the gate", () => {
  const view = read("src/features/merchant/MerchantCenterView.vue");
  assert.match(view, /MerchantCenterGate/);
  assert.match(view, /v-else-if="!center\.merchantVerified\.value"/);
});

test("journey: gate routes to verification view", () => {
  const view = read("src/features/merchant/MerchantCenterView.vue");
  assert.match(view, /setActiveView\("verification"\)/);

  const gate = read("src/features/merchant/MerchantCenterGate.vue");
  assert.match(gate, /goVerify/);
  assert.match(gate, /data-testid="merchant-center-gate-cta"/);
});

// Step 4: merchant detail page surfaces both errand branches.

test("journey: merchant detail page exposes available + unavailable errand entries", () => {
  const block = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(block, /data-testid="post-detail-merchant-errand-entry"/);
  assert.match(block, /data-testid="post-detail-merchant-errand-unavailable"/);
  assert.match(block, /data-testid="post-detail-merchant-errand-reason"/);
});

test("journey: detail page receives errand reason from the post DTO", () => {
  const panel = read("src/features/detail/PostDetailPanel.vue");
  assert.match(panel, /:errand-unavailable-reason="post\?\.errandUnavailableReason"/);

  const posts = read("src/api/posts.ts");
  // Wire shape: backend may attach reason at top level or under `errand`.
  // The normalizer must accept either to keep the DTO version-agnostic.
  assert.match(posts, /errandUnavailableReason/);
  assert.match(posts, /normalizeMerchantErrandEligibility/);
});
