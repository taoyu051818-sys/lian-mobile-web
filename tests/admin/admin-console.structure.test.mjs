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

test("api/admin attaches Bearer headers only through the explicit ops-token helper", () => {
  const src = read("src/api/admin.ts");
  assert.match(src, /function\s+withAuthHeader\(token/);
  assert.match(src, /if\s*\(token\)\s*headers\.set\("authorization",\s*`Bearer\s*\$\{token\}`\)/);
  const wrappedSites = src.match(/withAuthHeader\(token/g) || [];
  assert.ok(
    wrappedSites.length >= 8,
    "admin ops endpoints must keep the explicit Bearer fallback path",
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

test("api/admin wires aggregate verification queue, aggregate PATCH, and realname reveal", () => {
  const src = read("src/api/admin.ts");
  // Aggregate GET — unchanged from #425.
  assert.match(src, /\/api\/admin\/verifications\?/);
  // Aggregate PATCH — ps#518 / #511 canonical contract: one route per
  // verificationId, no channel segment in the path.
  assert.match(
    src,
    /\/api\/admin\/verifications\/\$\{encodeURIComponent\(request\.verificationId\)\}/,
  );
  // Realname reveal stays per-channel (only that lane has a reveal endpoint).
  assert.match(
    src,
    /\/api\/admin\/verifications\/realname\/\$\{encodeURIComponent\(request\.verificationId\)\}/,
  );
  assert.match(src, /reviewerNote/);
  // Decision payload is restricted — no free-form publicSummary writeback
  // from the client; backend owns publicSummary derivation.
  assert.doesNotMatch(
    src,
    /patchAdminVerificationRequest[\s\S]*publicSummary/,
    "client must not POST publicSummary back to the aggregate PATCH",
  );
});

test("api/admin no longer branches the PATCH path on verificationType", () => {
  const src = read("src/api/admin.ts");
  // Per-channel PATCH branching was the legacy contract (pre-ps#518).
  // The aggregate path resolves the channel server-side from the id.
  assert.doesNotMatch(
    src,
    /\/api\/admin\/verifications\/org-join\/\$\{verificationId\}/,
    "aggregate cutover (ps#518) drops the org-join PATCH branch",
  );
  assert.doesNotMatch(
    src,
    /\/api\/admin\/verifications\/merchant\/\$\{verificationId\}/,
    "aggregate cutover (ps#518) drops the merchant PATCH branch",
  );
  assert.doesNotMatch(
    src,
    /\/api\/admin\/verifications\/runner\/\$\{verificationId\}/,
    "aggregate cutover (ps#518) drops the runner PATCH branch",
  );
});

test("api/admin exposes a discriminated publicSummary union per channel", () => {
  const src = read("src/api/admin.ts");
  for (const name of [
    "AdminVerificationOrgJoinSummary",
    "AdminVerificationRealnameSummary",
    "AdminVerificationMerchantSummary",
    "AdminVerificationRunnerSummary",
    "AdminVerificationPublicSummary",
  ]) {
    assert.match(
      src,
      new RegExp(`export (?:interface|type) ${name}\\b`),
      `${name} must be exported as part of the aggregate publicSummary contract`,
    );
  }
});

// --- token gate: sessionStorage round-trip + auto-clear on 401 ---

test("useAdminToken persists in sessionStorage under a namespaced key", () => {
  const src = read("src/features/admin/useAdminToken.ts");
  assert.match(src, /sessionStorage/);
  assert.match(src, /"lian\.adminToken"/);
  assert.doesNotMatch(src, /localStorage/);
});

test("useAdminToken clears the fallback token from sessionStorage and never localStorage", () => {
  const src = read("src/features/admin/useAdminToken.ts");
  const clearMatch = src.match(/function\s+clearToken\s*\([^)]*\)\s*\{(?<body>[\s\S]*?)\n\s*\}/);
  assert.ok(clearMatch?.groups?.body, "clearToken body must be locatable");
  assert.match(clearMatch.groups.body, /writeStorage\(""\)/);
  assert.doesNotMatch(clearMatch.groups.body, /localStorage/);
  assert.match(src, /sessionStorage\.removeItem\(STORAGE_KEY\)/);
  assert.doesNotMatch(src, /localStorage/);
});

test("shared admin token key is never stored in localStorage", () => {
  for (const rel of ["src/features/admin/useAdminToken.ts", "public/tools/map-v2-editor.js"]) {
    const src = read(rel);
    assert.doesNotMatch(src, /localStorage[\s\S]{0,120}lian\.adminToken/);
    assert.doesNotMatch(src, /lian\.adminToken[\s\S]{0,120}localStorage/);
  }
});

test("useAdminToken exposes a sessionAdmin flag separate from the ops token", () => {
  const src = read("src/features/admin/useAdminToken.ts");
  assert.match(src, /sessionAdmin/);
  assert.match(src, /setSessionAdmin/);
  assert.match(src, /clearSessionAdmin/);
  assert.match(src, /sessionAdminRef\.value\s*=\s*false[\s\S]*?writeStorage\(trimmed\)/);
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

test("AdminView probes /api/admin/me on entry before using the ops token fallback", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /fetchAdminMe/);
  assert.match(src, /isAdminMeRoleEligible/);
  assert.match(src, /sessionAdmin/);
  assert.match(src, /consoleEnabled/);
  assert.match(src, /sessionAdmin\.value\s*\|\|\s*Boolean\(token\.value\)/);
  assert.match(src, /probeAdminSession/);
  assert.doesNotMatch(src, /if\s*\(token\.value\)\s*return/);
  assert.match(src, /await\s+probeAdminSession\(\)/);
});

test("api/admin probes session-admin without attaching a Bearer header", () => {
  const src = read("src/api/admin.ts");
  const match = src.match(/export async function fetchAdminMe[\s\S]*?\n\}/);
  assert.ok(match, "fetchAdminMe body must be locatable");
  assert.doesNotMatch(match[0], /withAuthHeader|authorization|Bearer/);
});

test("AdminView clears the ops token when session-admin mode is available", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /setSessionAdmin\(true\)[\s\S]*?clearToken\(\)/);
});

test("AdminView clears both admin auth modes when leaving the admin surface", () => {
  const src = read("src/features/admin/AdminView.vue");
  assert.match(src, /onBeforeUnmount/);
  assert.match(src, /clearAdminAccess/);
  assert.match(src, /clearToken\(\)/);
  assert.match(src, /clearSessionAdmin\(\)/);
});

test("api/admin exposes a session probe and a role-eligibility helper", () => {
  const src = read("src/api/admin.ts");
  assert.match(src, /export async function fetchAdminMe\b/);
  assert.match(src, /export function isAdminMeRoleEligible\b/);
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

test("ProfileView clears fallback admin access on logout or auth change", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /clearAdminAccessState/);
  assert.match(src, /function\s+enterGuestState\s*\([^)]*\)\s*\{[\s\S]*?clearAdminAccessState\(\)/);
  assert.match(
    src,
    /async function\s+handleAuthenticated\s*\([^)]*\)\s*\{[\s\S]*?clearAdminAccessState\(\)/,
  );
});

test("AdminView mounts verification queue as a first-class admin tab", () => {
  const viewSrc = read("src/features/admin/AdminView.vue");
  const brandSrc = read("src/config/brand/admin.ts");
  const blockSrc = read("src/features/admin/AdminVerificationBlock.vue");
  assert.match(viewSrc, /"verifications"/);
  assert.match(viewSrc, /loadVerificationRequests/);
  assert.match(brandSrc, /ADMIN_VERIFICATION_TAB_LABEL\s*=\s*"认证审核"/);
  assert.match(blockSrc, /ADMIN_VERIFICATION_REALNAME_MASKED_HINT/);
});

test("AdminView keeps verification decisions bounded to pending requests", () => {
  const helperSrc = read("src/features/admin/admin-verification.ts");
  const blockSrc = read("src/features/admin/AdminVerificationBlock.vue");
  assert.match(helperSrc, /canReviewRequest/);
  assert.match(helperSrc, /request\.status\s*===\s*"pending"/);
  assert.match(blockSrc, /emit\('review', request, 'approved'\)/);
  assert.match(blockSrc, /emit\('review', request, 'rejected'\)/);
  assert.match(blockSrc, /emit\('reveal', request\)/);
});

test("AdminView renders verification-review empty guidance for each status bucket", () => {
  const helperSrc = read("src/features/admin/admin-verification.ts");
  const blockSrc = read("src/features/admin/AdminVerificationBlock.vue");
  assert.match(helperSrc, /getVerificationEmptyState/);
  assert.match(helperSrc, /case "pending"/);
  assert.match(helperSrc, /case "approved"/);
  assert.match(helperSrc, /case "rejected"/);
  assert.match(blockSrc, /data-testid="admin-verification-empty"/);
  assert.match(blockSrc, /emptyState\.title/);
  assert.match(blockSrc, /emptyState\.body/);
});

// --- brand registration ---

test("admin brand module is re-exported from brand/index", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /from "\.\/admin"/);
});

// --- empty-state next-step copy (issue #725) ---

test("admin queue/audit empty-state brands include both headline and hint", () => {
  const src = read("src/config/brand/admin.ts");
  assert.match(src, /ADMIN_QUEUE_EMPTY\s*=\s*"[^"]+"/);
  assert.match(src, /ADMIN_QUEUE_EMPTY_HINT\s*=\s*"[^"]+"/);
  assert.match(src, /ADMIN_AUDIT_EMPTY\s*=\s*"[^"]+"/);
  assert.match(src, /ADMIN_AUDIT_EMPTY_HINT\s*=\s*"[^"]+"/);
});

test("AdminQueueList renders the queue empty-state hint with a stable testid (#725)", () => {
  const src = read("src/features/admin/AdminQueueList.vue");
  assert.match(src, /data-testid="admin-queue-empty"[\s\S]*?ADMIN_QUEUE_EMPTY_HINT/);
});

test("AdminAuditLogList renders the audit empty-state hint with a stable testid (#725)", () => {
  const src = read("src/features/admin/AdminAuditLogList.vue");
  assert.match(src, /data-testid="admin-audit-empty"[\s\S]*?ADMIN_AUDIT_EMPTY_HINT/);
});
