import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- view registration: merchant is a secret view, not a bottom tab ---

test("merchant is registered as an AppViewKey", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /"merchant"/);
  assert.match(src, /merchant:\s*"content"/);
});

test("merchant view does not appear in the bottom-tab appViews array", () => {
  const src = read("src/app/view-types.ts");
  const arrayMatch = src.match(
    /export const appViews:\s*AppViewDefinition\[\]\s*=\s*\[(?<body>[\s\S]*?)\];/,
  );
  assert.ok(arrayMatch, "appViews array must exist");
  assert.doesNotMatch(arrayMatch.groups.body, /key:\s*"merchant"/);
});

test("AppViewHost lazy-loads MerchantCenterView", () => {
  const src = read("src/app/AppViewHost.vue");
  assert.match(src, /merchant:\s*asyncView/);
  assert.match(src, /\.\.\/features\/merchant/);
  assert.match(src, /MerchantCenterView/);
});

test("useActiveView accepts secret view 'merchant'", () => {
  const viewTypes = read("src/app/view-types.ts");
  // After PR #676, useActiveView no longer keeps a SECRET_VIEWS allowlist —
  // viewFromHash is the single source of truth and accepts the full
  // AppViewKey union. Pin the type-level guarantee instead so the secret
  // view stays reachable.
  assert.match(viewTypes, /"merchant"/);
  assert.match(viewTypes, /export type AppViewKey/);
});

// --- types: merchant-center list item + errand reason union ---

test("MerchantCenterPostItem carries tid + title + hours + errandSupported", () => {
  // Issue #646 (refactor): merchant center now lists user-authored merchant
  // posts derived from /api/me/posts client-side, not a /api/me/merchant-center
  // round-trip. The list-item shape mirrors what the post detail view needs to
  // re-render the same merchant block.
  const src = read("src/types/merchant.ts");
  assert.match(src, /export interface MerchantCenterPostItem/);
  assert.match(src, /tid:\s*number/);
  assert.match(src, /title:\s*string/);
  assert.match(src, /hours:\s*string/);
  assert.match(src, /errandSupported:\s*boolean/);
});

test("MerchantErrandUnavailableReason union covers the documented codes", () => {
  const src = read("src/types/merchant.ts");
  for (const code of [
    "not_verified",
    "no_runner_coverage",
    "off_hours",
    "merchant_paused",
    "unknown",
  ]) {
    assert.match(src, new RegExp(`"${code}"`));
  }
});

// --- API: client-side derivation from /api/me/posts ---

test("api/merchant pulls merchant items from /api/me/posts", () => {
  const src = read("src/api/merchant.ts");
  // No backend route is introduced — we reuse the existing endpoint that
  // profile's "我发布" tab already consumes.
  assert.match(src, /\/api\/me\/posts/);
  assert.match(src, /export async function fetchMyMerchantPosts/);
  assert.match(src, /apiGet</);
  // /api/me/merchant-center is NOT a route this layer is allowed to touch.
  assert.doesNotMatch(src, /\/api\/me\/merchant-center/);
});

test("api/merchant detects merchant items via the three documented signals", () => {
  const src = read("src/api/merchant.ts");
  // presentationIntent === "merchant", contentType merchant_*, or inline
  // metadata.merchant block — keeping all three lets the detector survive
  // wire-shape changes.
  assert.match(src, /presentationIntent === "merchant"/);
  assert.match(src, /contentType\.startsWith\("merchant_"\)/);
  assert.match(src, /hasMerchantBlock/);
});

test("api/merchant exposes errand-eligibility normalizer with bounded reason set", () => {
  const src = read("src/api/merchant.ts");
  assert.match(src, /export function normalizeMerchantErrandEligibility/);
  // Unknown reason codes must collapse to the "unknown" sentinel — we don't
  // want to leak server-side tags into UI dispatch.
  assert.match(src, /ERRAND_REASON_CODES/);
  assert.match(src, /"unknown"/);
});

// --- composable: useMerchantCenter owns the round-trip + post list state ---

test("useMerchantCenter exposes posts + refresh + loaded state", () => {
  const src = read("src/features/merchant/useMerchantCenter.ts");
  assert.match(src, /export function useMerchantCenter/);
  assert.match(src, /fetchMyMerchantPosts/);
  assert.match(src, /posts/);
  assert.match(src, /refresh/);
  // Loaded flag prevents flashing the empty list while the request is in flight.
  assert.match(src, /loaded/);
});

// --- gate component: routes the user to the verification center ---

test("MerchantCenterGate exposes the gate testid + verify CTA", () => {
  const src = read("src/features/merchant/MerchantCenterGate.vue");
  assert.match(src, /data-testid="merchant-center-gate"/);
  assert.match(src, /data-testid="merchant-center-gate-cta"/);
  assert.match(src, /goVerify/);
});

// --- view: gate vs verified branches + chrome wiring ---

test("MerchantCenterView shows the gate when the user is not merchant_verified", () => {
  const src = read("src/features/merchant/MerchantCenterView.vue");
  // Identity comes from /api/auth/me via useIsMerchantVerified — never the
  // empty-list shortcut.
  assert.match(src, /useIsMerchantVerified/);
  assert.match(src, /MerchantCenterGate/);
  assert.match(src, /v-if="!isMerchantVerified"/);
});

test("MerchantCenterView surfaces the post list with hours + errand status", () => {
  const src = read("src/features/merchant/MerchantCenterView.vue");
  assert.match(src, /data-testid="merchant-center-list"/);
  assert.match(src, /MERCHANT_CENTER_HOURS_LABEL/);
  assert.match(src, /MERCHANT_CENTER_ERRAND_AVAILABLE/);
  assert.match(src, /MERCHANT_CENTER_ERRAND_UNAVAILABLE/);
  assert.match(src, /merchant-center-empty/);
});

test("MerchantCenterView refreshes the post list on mount when verified", () => {
  const src = read("src/features/merchant/MerchantCenterView.vue");
  assert.match(src, /onMounted/);
  assert.match(src, /center\.refresh/);
});

// --- post detail: errand entry surfaces the unavailable reason ---

test("PostDetailMerchantBlock renders an unavailable branch with reason text", () => {
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /data-testid="post-detail-merchant-errand-unavailable"/);
  assert.match(src, /data-testid="post-detail-merchant-errand-reason"/);
  assert.match(src, /errandUnavailable/);
  assert.match(src, /errandReasonText/);
});

test("PostDetail type carries errandUnavailableReason fields", () => {
  const src = read("src/types/post.ts");
  assert.match(src, /errandUnavailableReason\?:\s*MerchantErrandUnavailableReason\s*\|\s*""/);
  assert.match(src, /errandUnavailableReasonText\?:\s*string/);
});

test("normalizePostDetail forwards errand reason fields when entry is unavailable", () => {
  const src = read("src/api/posts.ts");
  assert.match(src, /errandUnavailableReason/);
  assert.match(src, /errandUnavailableReasonText/);
  assert.match(src, /normalizeMerchantErrandEligibility/);
});

test("PostDetailContent forwards errand reason props to MerchantBlock", () => {
  const src = read("src/features/detail/PostDetailContent.vue");
  assert.match(src, /:errand-unavailable-reason="errandUnavailableReason"/);
  assert.match(src, /:errand-unavailable-reason-text="errandUnavailableReasonText"/);
});

test("PostDetailPanel forwards errand reason props from post to content", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  assert.match(src, /:errand-unavailable-reason="post\?\.errandUnavailableReason"/);
  assert.match(src, /:errand-unavailable-reason-text="post\?\.errandUnavailableReasonText"/);
});

// --- brand strings registered ---

test("merchant center brand strings are registered", () => {
  const src = read("src/config/brand/merchant.ts");
  for (const key of [
    "MERCHANT_CENTER_SECTION_LABEL",
    "MERCHANT_CENTER_ENTER_LABEL",
    "MERCHANT_CENTER_GATE_TITLE",
    "MERCHANT_CENTER_GATE_CTA",
    "MERCHANT_CENTER_POSTS_TITLE",
    "MERCHANT_CENTER_HOURS_LABEL",
    "MERCHANT_CENTER_ERRAND_AVAILABLE",
    "MERCHANT_CENTER_ERRAND_UNAVAILABLE",
    "MERCHANT_CENTER_OPEN_DETAIL",
    "MERCHANT_CENTER_EMPTY_HEADLINE",
    "MERCHANT_CENTER_EMPTY_HINT",
    "MERCHANT_ERRAND_UNAVAILABLE_LABEL",
    "MERCHANT_ERRAND_REASON_NOT_VERIFIED",
    "MERCHANT_ERRAND_REASON_NO_RUNNER_COVERAGE",
    "MERCHANT_ERRAND_REASON_OFF_HOURS",
    "MERCHANT_ERRAND_REASON_MERCHANT_PAUSED",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`));
  }
});

// --- ProfileView entry: gates on merchant_verified, opens secret view ---

test("useIsMerchantVerified composable is exported from features/merchant", () => {
  const src = read("src/features/merchant/index.ts");
  assert.match(src, /export\s*\{\s*useIsMerchantVerified\s*\}/);

  const composable = read("src/features/merchant/useIsMerchantVerified.ts");
  // Authoritative source is verificationState.merchant_verified.active; fall
  // back to the flat tag list so older /api/auth/me payloads still gate.
  assert.match(composable, /verificationState\?\.merchant_verified/);
  assert.match(composable, /record\.active/);
  assert.match(composable, /verificationTags|tags/);
  assert.match(composable, /"merchant_verified"/);
});

test("ProfileView mounts the merchant-center entry when the user holds merchant_verified", () => {
  const src = read("src/features/profile/ProfileView.vue");
  // ProfileView keeps its own `hasActiveVerificationTag` gate (shared with the
  // unlock cards / runner entry) instead of importing the merchant composable
  // — both paths read the same `verificationState.merchant_verified.active`
  // truth, so the entry is gated correctly either way. What matters here is
  // that the entry is present, hidden behind merchant_verified, and routes
  // into the merchant secret view.
  assert.match(src, /hasActiveVerificationTag\(user\.value, "merchant_verified"\)/);
  assert.match(src, /data-testid="profile-merchant-entry"/);
  assert.match(src, /v-if="isMerchantVerified"/);
  assert.match(src, /setActiveView\('merchant'\)/);
  assert.match(src, /MERCHANT_CENTER_ENTER_LABEL/);
});
