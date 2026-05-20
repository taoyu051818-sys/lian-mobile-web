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

// --- types: merchant-center DTO + errand reason union ---

test("MerchantCenterSnapshot carries verified flag, profile, errand block", () => {
  const src = read("src/types/merchant.ts");
  assert.match(src, /export interface MerchantCenterSnapshot/);
  assert.match(src, /merchantVerified:\s*boolean/);
  assert.match(src, /profile:\s*MerchantProfileSummary\s*\|\s*null/);
  assert.match(src, /errand:\s*MerchantErrandEligibility/);
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

test("MerchantProfileSummary mirrors backend metadata.merchant fields", () => {
  const src = read("src/types/merchant.ts");
  assert.match(src, /export interface MerchantProfileSummary/);
  for (const field of ["name", "category", "hours", "contact", "errandSupported", "verifiedAt"]) {
    assert.match(src, new RegExp(`\\b${field}\\b`));
  }
});

// --- API: GET /api/me/merchant-center + normalizers ---

test("api/merchant calls GET /api/me/merchant-center via apiGet", () => {
  const src = read("src/api/merchant.ts");
  assert.match(src, /\/api\/me\/merchant-center/);
  assert.match(src, /export async function fetchMerchantCenter/);
  assert.match(src, /apiGet</);
});

test("api/merchant exposes errand-eligibility normalizer with bounded reason set", () => {
  const src = read("src/api/merchant.ts");
  assert.match(src, /export function normalizeMerchantErrandEligibility/);
  // Unknown reason codes must collapse to the "unknown" sentinel — we don't
  // want to leak server-side tags into UI dispatch.
  assert.match(src, /ERRAND_REASON_CODES/);
  assert.match(src, /"unknown"/);
});

// --- composable: useMerchantCenter owns the round-trip + gate state ---

test("useMerchantCenter exposes merchantVerified + errand + refresh", () => {
  const src = read("src/features/merchant/useMerchantCenter.ts");
  assert.match(src, /export function useMerchantCenter/);
  assert.match(src, /fetchMerchantCenter/);
  assert.match(src, /merchantVerified/);
  assert.match(src, /errand/);
  assert.match(src, /refresh/);
  // Loaded flag prevents flashing the gate while the snapshot is in flight.
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

test("MerchantCenterView shows gate when merchantVerified=false", () => {
  const src = read("src/features/merchant/MerchantCenterView.vue");
  assert.match(src, /MerchantCenterGate/);
  assert.match(src, /v-else-if="!center\.merchantVerified\.value"/);
  assert.match(src, /setActiveView\("verification"\)/);
});

test("MerchantCenterView surfaces profile readout + errand status when verified", () => {
  const src = read("src/features/merchant/MerchantCenterView.vue");
  assert.match(src, /data-testid="merchant-center-profile"/);
  assert.match(src, /data-testid="merchant-center-profile-name"/);
  assert.match(src, /data-testid="merchant-center-errand"/);
  assert.match(src, /data-testid="merchant-center-errand-status"/);
  assert.match(src, /data-testid="merchant-center-errand-reason"/);
});

test("MerchantCenterView refreshes the snapshot on mount", () => {
  const src = read("src/features/merchant/MerchantCenterView.vue");
  assert.match(src, /onMounted\([\s\S]*center\.refresh/);
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
    "MERCHANT_CENTER_PROFILE_TITLE",
    "MERCHANT_CENTER_ERRAND_TITLE",
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
  assert.match(src, /import \{ useIsMerchantVerified \} from "\.\.\/merchant"/);
  assert.match(src, /const isMerchantVerified = useIsMerchantVerified\(user\)/);
  assert.match(src, /data-testid="profile-merchant-entry"/);
  assert.match(src, /v-if="isMerchantVerified"/);
  assert.match(src, /setActiveView\('merchant'\)/);
  assert.match(src, /MERCHANT_CENTER_ENTER_LABEL/);
});
