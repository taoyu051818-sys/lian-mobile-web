import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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
  assert.match(src, /SECRET_VIEWS/);
  assert.match(src, /"verification"/);
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
    "campus_verified",
    "org_member",
    "realname_verified",
    "merchant_verified",
    "runner",
  ]) {
    assert.match(src, new RegExp(`tag:\\s*"${tag}"`));
  }
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

test("VerificationView shows the new empty-state guidance before any grant exists", () => {
  const src = read("src/features/verification/VerificationView.vue");
  const brand = read("src/config/brand/verification.ts");
  assert.match(src, /data-testid="verification-empty-state"/);
  assert.match(src, /!loading && !hasAnyVerificationRecord/);
  assert.match(brand, /VERIFICATION_EMPTY_TITLE/);
  assert.match(brand, /VERIFICATION_EMPTY_BODY/);
});

// --- brand registration ---

test("verification brand module is re-exported from brand/index", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /from "\.\/verification"/);
});
