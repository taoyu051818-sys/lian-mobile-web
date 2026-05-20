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
  assert.match(src, /SECRET_VIEWS/);
  assert.match(src, /"admin"/);
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

test("api/admin exposes report, user action, audit, and aggregate verification helpers", () => {
  const src = read("src/api/admin.ts");
  for (const fn of [
    "fetchAdminReports",
    "patchAdminReport",
    "postAdminPostAction",
    "patchAdminUserStatus",
    "fetchAdminVerifications",
    "patchAdminVerification",
    "fetchAdminRealnameVerificationReveal",
    "fetchAdminAuditLog",
  ]) {
    assert.match(src, new RegExp(`export async function ${fn}\\b`));
  }
});

test("api/admin uses the aggregate queue path, truthful transition routes, and explicit reveal", () => {
  const src = read("src/api/admin.ts");
  assert.match(src, /\/api\/admin\/verifications\?\$\{query\}/);
  assert.match(src, /verificationType/);
  assert.match(src, /reveal=true/);
  assert.match(src, /\/api\/admin\/verifications\/\$\{request\.verificationType\}/);
  assert.doesNotMatch(src, /reviewing/);
  assert.doesNotMatch(src, /payload\?: Record<string, unknown>/);
});

// --- token gate: sessionStorage round-trip + auto-clear on 401 ---

test("useAdminToken persists in sessionStorage under a namespaced key", () => {
  const src = read("src/features/admin/useAdminToken.ts");
  assert.match(src, /sessionStorage/);
  assert.match(src, /"lian\.adminToken"/);
});

test("useAdminConsole clears the token on 401/403", () => {
  const src = read("src/features/admin/useAdminConsole.ts");
  assert.match(src, /onTokenInvalid/);
  assert.match(src, /status === 401|status === 403/);
});

test("useAdminConsole stores revealed realname payloads separately from default queue data", () => {
  const src = read("src/features/admin/useAdminConsole.ts");
  assert.match(src, /revealedRealnames/);
  assert.match(src, /loadRealnameReveal/);
  assert.match(src, /fetchAdminRealnameVerificationReveal/);
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

test("AdminView shows the token gate while token is empty", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /<AdminTokenGate/);
  assert.match(src, /v-if="!token"/);
});

test("AdminView exit button clears the token via clearToken", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /admin:exit/);
  assert.match(src, /clearToken\(\)/);
});

test("AdminView mounts verification queue as a first-class admin tab", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /AdminVerificationQueueList/);
  assert.match(src, /ADMIN_TAB_VERIFICATIONS/);
  assert.match(src, /activeTab === 'verifications'/);
  assert.match(src, /loadVerificationRequests/);
  assert.match(src, /reviewVerificationRequest/);
  assert.match(src, /loadRealnameReveal/);
});

test("AdminVerificationQueueList renders publicSummary and never raw payload by default", () => {
  const src = read("src/features/admin/AdminVerificationQueueList.vue");
  assert.match(src, /publicSummary/);
  assert.match(src, /ADMIN_VERIFICATION_REDACTED_HINT/);
  assert.match(src, /ADMIN_VERIFICATION_REVEAL/);
  assert.doesNotMatch(src, /request\.payload/);
  assert.doesNotMatch(src, /JSON\.stringify\(request\.payload/);
});

test("AdminVerificationQueueList only offers approve and reject actions", () => {
  const src = read("src/features/admin/AdminVerificationQueueList.vue");
  assert.match(src, /submitReview\(request, 'approved'\)/);
  assert.match(src, /submitReview\(request, 'rejected'\)/);
  assert.doesNotMatch(src, /reviewing/);
});

// --- brand registration ---

test("admin brand module is re-exported from brand/index", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /from "\.\/admin"/);
});
