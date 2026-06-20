import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const runnerVerifiedShorthand = "runner" + "_verified";

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- view registration: verification is a secret view, not a bottom tab ---

test("verification is registered as an AppViewKey", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /"verification"/);
  assert.match(src, /verification:\s*"content"/);
});

test("verification view does not appear in the bottom-tab appViews array", () => {
  const src = read("src/app/view-types.ts");
  const arrayMatch = src.match(
    /export const appViews:\s*AppViewDefinition\[\]\s*=\s*\[(?<body>[\s\S]*?)\];/,
  );
  assert.ok(arrayMatch, "appViews array must exist");
  assert.doesNotMatch(arrayMatch.groups.body, /key:\s*"verification"/);
});

test("AppViewHost lazy-loads VerificationView component", () => {
  const src = read("src/app/AppViewHost.vue");
  assert.match(src, /verification:\s*asyncView/);
  assert.match(src, /\.\.\/features\/verification/);
});

test("useActiveView accepts secret view 'verification'", () => {
  const src = read("src/app/useActiveView.ts");
  // useActiveView relies on the view-hash singleton to accept any AppViewKey,
  // including the secret views. The comment in the source documents this; the
  // structural assertion is that pushViewHash is the writer and verification
  // is named in the secret-view list.
  assert.match(src, /getViewFromHashRef/);
  assert.match(src, /pushViewHash\(key\)/);
  assert.match(src, /secret views \([^)]*verification[^)]*\)/);
});

// --- API contract: verification calls the new /api/auth/verify/campus-email/* routes ---

test("api/verification posts to /api/auth/verify/campus-email/send and /confirm", () => {
  const src = read("src/api/verification.ts");
  assert.match(src, /\/api\/auth\/verify\/campus-email\/send/);
  assert.match(src, /\/api\/auth\/verify\/campus-email\/confirm/);
  assert.match(src, /export async function sendCampusEmailCode\b/);
  assert.match(src, /export async function confirmCampusEmailCode\b/);
});

// --- ProfileView entry: verification button is unconditional (普通用户特性, 非 admin) ---

test("ProfileView links to verification view via setActiveView('verification')", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /VERIFICATION_ENTER_LABEL/);
  assert.match(src, /setActiveView\('verification'\)/);
});

test("ProfileView does NOT gate the verification entry on VITE_ADMIN_VISIBLE", () => {
  const src = read("src/features/profile/ProfileView.vue");
  // Verification entry is for any logged-in user, unlike the admin entry.
  const re = /class="profile-view__verification-link"/;
  assert.ok(re.test(src), "verification link must exist");
  // The verification footer must NOT carry v-if="adminEntryVisible"
  const wrappedRe = /v-if="adminEntryVisible"[\s\S]{0,80}profile-view__verification-link/;
  assert.doesNotMatch(src, wrappedRe);
});

// --- VerificationView: shows 5 verification rows and a campus-email writer ---

test("VerificationView renders all 5 verification descriptors", () => {
  const src = read("src/features/verification/verification-format.ts");
  for (const tag of [
    "VERIFICATION_TAG_CAMPUS",
    "VERIFICATION_TAG_ORG",
    "VERIFICATION_TAG_REALNAME",
    "VERIFICATION_TAG_MERCHANT",
    "VERIFICATION_TAG_RUNNER",
  ]) {
    assert.match(src, new RegExp(`tag:\\s*${tag}`));
  }
});

test("runner verification surfaces use the backend canonical tag", () => {
  const typeSrc = read("src/types/verification.ts");
  const descriptorSrc = read("src/features/verification/verification-format.ts");
  const runnerFixtureSrc = read("tests/e2e/fixtures/accounts.ts");
  const runnerCenterSrc = read("src/features/runner/useRunnerCenter.ts");
  const profileBadgeSrc = read("src/features/profile/ProfileVerificationBadges.vue");

  assert.match(typeSrc, /export const VERIFICATION_TAG_RUNNER\s*=\s*"runner"/);
  assert.match(typeSrc, /export const VERIFICATION_TAGS\s*=\s*\[/);
  assert.doesNotMatch(typeSrc, new RegExp(runnerVerifiedShorthand));
  assert.match(descriptorSrc, /VERIFICATION_TAG_RUNNER/);

  for (const src of [runnerFixtureSrc, runnerCenterSrc, profileBadgeSrc]) {
    assert.match(src, /"runner"/);
    assert.doesNotMatch(src, new RegExp(runnerVerifiedShorthand));
  }
  assert.match(runnerFixtureSrc, /expectedTags:\s*\["runner"\]/);
  assert.match(runnerCenterSrc, /flat\.has\("runner"\)/);
  assert.match(profileBadgeSrc, /data-tag="runner"/);
});

test("docs name runner verification with the backend canonical tag", () => {
  const readmeSrc = read("README.md");
  const prdSrc = read("docs/product/PRD_WAP_SECURITY_AUDIENCE_EVENT_V0.1.md");

  assert.match(readmeSrc, /runner capability uses `runner` as the canonical verification tag/);
  assert.match(readmeSrc, new RegExp(`Do not introduce \`${runnerVerifiedShorthand}\``));
  assert.match(prdSrc, /\|\s*`runner`\s*\|\s*跑腿骑手权限\s*\|/);
  assert.doesNotMatch(
    prdSrc,
    new RegExp(`\\|\\s*\`${runnerVerifiedShorthand}\`\\s*\\|\\s*跑腿骑手权限\\s*\\|`),
  );
});

test("VerificationView wires the campus-email send + confirm flow", () => {
  const src = read("src/features/verification/VerificationView.vue");
  assert.match(src, /useCampusEmailVerify/);
  assert.match(src, /campus\.requestCode/);
  assert.match(src, /campus\.submitCode/);
  // Refresh /api/auth/me on confirm so verificationState reflects the new tag.
  assert.match(src, /onConfirmed/);
  assert.match(src, /refreshUser/);
});

// --- brand registration ---

test("verification brand module is re-exported from brand/index", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /from "\.\/verification"/);
});

// --- empty-state next-step copy (issue #725) ---

test("verification brand exposes both the headline and the next-step hint", () => {
  const src = read("src/config/brand/verification.ts");
  assert.match(src, /VERIFICATION_NO_GRANT_HINT\s*=\s*"[^"]+"/);
  assert.match(src, /VERIFICATION_NO_GRANT_NEXT\s*=\s*"[^"]+"/);
});

test("VerificationView renders the no-grant placeholder with both headline and next-step hint (#725)", () => {
  const src = read("src/features/verification/VerificationView.vue");
  assert.match(src, /data-testid="verification-empty-grant"[\s\S]*?VERIFICATION_NO_GRANT_NEXT/);
});
