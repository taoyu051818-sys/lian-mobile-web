import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- view registration: admin is mounted but hidden from bottom-tab list ---

test("admin is registered as an AppViewKey", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /"admin"/);
  assert.match(src, /admin:\s*"content"/);
});

test("admin view does not appear in the bottom-tab appViews array", () => {
  const src = read("src/app/view-types.ts");
  const arrayMatch = src.match(
    /export const appViews:\s*AppViewDefinition\[\]\s*=\s*\[(?<body>[\s\S]*?)\];/,
  );
  assert.ok(arrayMatch, "appViews array must exist");
  assert.doesNotMatch(arrayMatch.groups.body, /key:\s*"admin"/);
});

test("AppViewHost lazy-loads AdminView component", () => {
  const src = read("src/app/AppViewHost.vue");
  assert.match(
    src,
    /admin:\s*asyncView\(\(\)\s*=>\s*import\("\.\.\/features\/admin"\)\.then\(\(m\)\s*=>\s*m\.AdminView\)\)/,
  );
});

test("useActiveView accepts secret views (admin) outside appViews array", () => {
  const src = read("src/app/useActiveView.ts");
  assert.match(src, /getViewFromHashRef/);
  assert.match(src, /pushViewHash\(key\)/);
  assert.match(src, /secret views \(admin\/verification\/merchant\/errand-order\/runner\)/);
});

// --- API contract: every admin call must inject Authorization: Bearer <token> ---

test("api/admin attaches Bearer header on every request", () => {
  const src = read("src/api/admin.ts");
  assert.match(src, /authorization/i);
  assert.match(src, /Bearer\s*\$\{token\}/);
  const callSites = src.match(/apiGet<|apiSend</g) || [];
  const wrappedSites = src.match(/withAuthHeader\(token/g) || [];
  assert.ok(
    wrappedSites.length >= callSites.length,
    `expected every apiGet/apiSend to be wrapped by withAuthHeader (found ${callSites.length} calls vs ${wrappedSites.length} wrappers)`,
  );
});

test("api/admin exposes report, user action, audit, and verification operations", () => {
  const src = read("src/api/admin.ts");
  for (const fn of [
    "fetchAdminReports",
    "patchAdminReport",
    "postAdminPostAction",
    "patchAdminUserStatus",
    "fetchAdminVerificationRequests",
    "patchAdminVerificationRequest",
    "fetchAdminVerificationDetail",
    "fetchAdminAuditLog",
  ]) {
    assert.match(src, new RegExp(`export async function ${fn}\\b`));
  }
});

test("api/admin wires aggregate verification queue, backend-owned transitions, and realname reveal", () => {
  const src = read("src/api/admin.ts");
  assert.match(src, /\/api\/admin\/verifications\?/);
  assert.match(src, /request\.verificationType === "org-join"/);
  assert.match(src, /request\.verificationType === "realname"/);
  assert.match(src, /\/api\/admin\/verifications\/org-join\/\$\{verificationId\}/);
  assert.match(src, /\/api\/admin\/verifications\/realname\/\$\{verificationId\}/);
  assert.match(src, /reviewerNote/);
});

// --- token gate: sessionStorage round-trip + auto-clear on 401 ---

test("useAdminToken persists in sessionStorage under a namespaced key", () => {
  const src = read("src/features/admin/useAdminToken.ts");
  assert.match(src, /sessionStorage/);
  assert.match(src, /"lian\.adminToken"/);
});

test("useAdminToken exposes a sessionAdmin flag separate from the ops token", () => {
  const src = read("src/features/admin/useAdminToken.ts");
  assert.match(src, /sessionAdmin/);
  assert.match(src, /setSessionAdmin/);
  assert.match(src, /clearSessionAdmin/);
  // sessionAdmin must NOT be persisted to storage — it lives only in memory
  // so a refresh re-runs the /api/admin/me probe. Enforce by checking the
  // setSessionAdmin body does not call writeStorage.
  const setterMatch = src.match(
    /function\s+setSessionAdmin\s*\([^)]*\)\s*\{(?<body>[\s\S]*?)\n\s*\}/,
  );
  assert.ok(setterMatch?.groups?.body, "setSessionAdmin body must be locatable");
  assert.doesNotMatch(setterMatch.groups.body, /writeStorage|sessionStorage/);
});

test("useAdminConsole clears the token on 401/403", () => {
  const src = read("src/features/admin/useAdminConsole.ts");
  assert.match(src, /onTokenInvalid/);
  assert.match(src, /status === 401|status === 403/);
});

test("useAdminConsole tracks aggregate verification queue, review action, and revealed detail state", () => {
  const src = read("src/features/admin/useAdminConsole.ts");
  assert.match(src, /verificationRequests/);
  assert.match(src, /loadVerificationRequests/);
  assert.match(src, /reviewVerificationRequest/);
  assert.match(src, /revealVerificationRequest/);
  assert.match(src, /revealedVerificationDetails/);
});

// --- ProfileView entry: behind VITE_ADMIN_VISIBLE flag, never unconditional ---

test("ProfileView gates the admin entry button on VITE_ADMIN_VISIBLE", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /VITE_ADMIN_VISIBLE/);
  assert.match(src, /adminEntryVisible/);
  assert.match(src, /v-if="adminEntryVisible"/);
});

test("ProfileView does not render an unconditional admin link", () => {
  const src = read("src/features/profile/ProfileView.vue");
  const linkRe = /class="profile-view__admin-link"/;
  assert.ok(linkRe.test(src), "admin link must exist");
  const wrappedRe = /v-if="adminEntryVisible"[\s\S]*?profile-view__admin-link/;
  assert.match(src, wrappedRe);
});

// --- AdminView: gate before queue/audit, exit clears token ---

test("AdminView shows the token gate while no admin session is established", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /<AdminTokenGate/);
  assert.match(src, /v-else-if="!consoleEnabled"/);
});

test("AdminView probes /api/admin/me on entry and skips the token form on success", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /fetchAdminMe/);
  assert.match(src, /isAdminMeRoleEligible/);
  assert.match(src, /sessionAdmin/);
  // Console must mount when EITHER the ops token OR a session admin probe says ok.
  assert.match(src, /consoleEnabled/);
  assert.match(src, /Boolean\(token\.value\)\s*\|\|\s*sessionAdmin\.value/);
  // Probe runs on mount when there is no stored ops token.
  assert.match(src, /probeAdminSession/);
});

test("api/admin exposes a session probe and a role-eligibility helper", () => {
  const src = read("src/api/admin.ts");
  assert.match(src, /export async function fetchAdminMe\b/);
  assert.match(src, /export function isAdminMeRoleEligible\b/);
  // Helper must accept the token-bearer fast-path AND admin/moderator roles.
  assert.match(src, /viaToken/);
  assert.match(src, /admin/);
  assert.match(src, /moderator/);
});

test("AdminView exit button clears both the token and the session-admin flag", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /admin:exit/);
  assert.match(src, /clearToken\(\)/);
  assert.match(src, /clearSessionAdmin\(\)/);
});

test("AdminView mounts verification queue as a first-class admin tab", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /"verifications"/);
  assert.match(src, /loadVerificationRequests/);
  assert.match(src, /认证审核/);
  assert.match(src, /实名认证敏感字段仅在显式查看时通过后端审计路径读取/);
});

test("AdminView keeps verification decisions bounded to pending requests", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /canReviewRequest/);
  assert.match(src, /handleVerificationReview\(request, 'approved'\)/);
  assert.match(src, /handleVerificationReview\(request, 'rejected'\)/);
  assert.match(src, /handleVerificationReveal/);
});

// --- brand registration ---

test("admin brand module is re-exported from brand/index", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /from "\.\/admin"/);
});
