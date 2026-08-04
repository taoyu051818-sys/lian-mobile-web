import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- view registration: runner is a secret view, not a bottom tab -----------

test("runner is registered as an AppViewKey", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /"runner"/);
  assert.match(src, /runner:\s*"content"/);
});

test("runner view does not appear in the bottom-tab appViews array", () => {
  const src = read("src/app/view-types.ts");
  const arrayMatch = src.match(
    /export const appViews:\s*AppViewDefinition\[\]\s*=\s*\[(?<body>[\s\S]*?)\];/,
  );
  assert.ok(arrayMatch, "appViews array must exist");
  assert.doesNotMatch(arrayMatch.groups.body, /key:\s*"runner"/);
});

test("AppViewHost lazy-loads RunnerCenterView component", () => {
  const src = read("src/app/AppViewHost.vue");
  assert.match(src, /runner:\s*asyncView/);
  assert.match(src, /\.\.\/features\/runner/);
  assert.match(src, /m\.RunnerCenterView/);
});

test("useActiveView accepts secret view 'runner'", () => {
  const src = read("src/app/useActiveView.ts");
  assert.match(src, /getViewFromHashRef/);
  assert.match(src, /pushViewHash\(key\)/);
  assert.match(src, /secret views \(admin\/verification\/merchant\/errand-order\/runner\)/);
});

// --- API contract: runner endpoints use backend errand order routes ----------

test("api/runner exposes available, active, and four state-transition endpoints", () => {
  const src = read("src/api/runner.ts");
  assert.match(src, /\/api\/errands\/orders\/available/);
  assert.match(src, /nextOffset\?: number \| null/);
  assert.match(src, /\/api\/errands\/orders\/mine\?role=runner/);
  // The transition endpoint is one shared helper that templates the action;
  // assert each action name is present and the path includes the backend errand namespace.
  assert.match(
    src,
    /\/api\/errands\/orders\/\$\{encodeURIComponent\(orderId\)\}\/\$\{backendAction\}/,
  );
  assert.match(src, /action === "at_shop" \? "at-shop" : action/);
  for (const fn of [
    "fetchAvailableRunnerOrders",
    "fetchActiveRunnerOrders",
    "acceptRunnerOrder",
    "markRunnerOrderAtShop",
    "markRunnerOrderPickedUp",
    "markRunnerOrderDelivered",
  ]) {
    assert.match(src, new RegExp(`export (async )?function ${fn}\\b`));
  }
});

test("runner state machine declares all four progress actions", () => {
  const src = read("src/types/runner.ts");
  for (const action of ["accept", "at_shop", "pickup", "deliver"]) {
    assert.match(src, new RegExp(`"${action}"`));
  }
  for (const status of [
    "available",
    "accepted",
    "at_shop",
    "picked_up",
    "delivered",
    "cancelled",
  ]) {
    assert.match(src, new RegExp(`"${status}"`));
  }
});

// --- gate: ProfileView entry visible only to canonical runner tag -----------

test("ProfileView gates the runner entry on runner verification", () => {
  const src = read("src/features/profile/ProfileView.vue");
  // ProfileView decides runner-verified via hasActiveVerificationTag(user, "runner")
  // (issue #710 unified the gate helper). The structural assertion is that the
  // gate uses that helper and feeds the result into v-if="isRunnerVerified".
  assert.match(src, /hasActiveVerificationTag\(user\.value,\s*"runner"\)/);
  assert.match(src, /isRunnerVerified/);
  assert.match(src, /v-if="isRunnerVerified"/);
});

test("ProfileView routes the runner entry to setActiveView('runner')", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /setActiveView\(['"]runner['"]\)/);
  assert.match(src, /RUNNER_ENTER_LABEL/);
});

test("ProfileView does NOT render an unconditional runner link", () => {
  const src = read("src/features/profile/ProfileView.vue");
  // The entry must live inside a v-if="isRunnerVerified" block. A bare button
  // without that gate would surface the runner center to non-runners.
  const linkRe = /class="profile-view__runner-link"/;
  assert.ok(linkRe.test(src), "runner link must exist");
  const wrappedRe = /v-if="isRunnerVerified"[\s\S]{0,200}profile-view__runner-link/;
  assert.match(src, wrappedRe);
});

// --- RunnerCenterView shape: gate-then-content, four state buttons ---------

test("RunnerCenterView falls back to RunnerGate when verification is missing or the queue rejects the session", () => {
  const src = read("src/features/runner/RunnerCenterView.vue");
  assert.match(src, /<RunnerGate/);
  assert.match(src, /shouldShowRunnerGate/);
  assert.match(src, /availableNeedsRunnerGate/);
});

test("RunnerCenterView renders the available-orders and active-orders tabs", () => {
  const src = read("src/features/runner/RunnerCenterView.vue");
  assert.match(src, /RUNNER_TAB_AVAILABLE/);
  assert.match(src, /RUNNER_TAB_ACTIVE/);
  // Two branches drive the body: an explicit `activeTab === 'available'`
  // condition and the implicit `v-else` for the `active` slice. We only
  // assert the explicit one — the else branch is structural sugar.
  assert.match(src, /activeTab === ['"]available['"]/);
  assert.match(src, /RUNNER_LIST_EMPTY_ACTIVE/);
});

test("RunnerOrderCard renders a button per non-terminal status", () => {
  const src = read("src/features/runner/RunnerOrderCard.vue");
  assert.match(src, /order\.status === ['"]available['"]/);
  assert.match(src, /order\.status === ['"]accepted['"]/);
  assert.match(src, /order\.status === ['"]at_shop['"]/);
  assert.match(src, /order\.status === ['"]picked_up['"]/);
  for (const action of [
    "RUNNER_ACTION_ACCEPT",
    "RUNNER_ACTION_AT_SHOP",
    "RUNNER_ACTION_PICKUP",
    "RUNNER_ACTION_DELIVER",
  ]) {
    assert.match(src, new RegExp(action));
  }
});

test("RunnerGate offers a link to the verification center", () => {
  const src = read("src/features/runner/RunnerGate.vue");
  assert.match(src, /RUNNER_GATE_TITLE/);
  assert.match(src, /RUNNER_GATE_GO_VERIFY/);
  assert.match(src, /go-verify/);
});

test("RunnerCenterView routes the gate's go-verify event to verification view", () => {
  const src = read("src/features/runner/RunnerCenterView.vue");
  assert.match(src, /setActiveView\(["']verification["']\)/);
});

// --- brand registration -----------------------------------------------------

test("runner brand module is re-exported from brand/index", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /from "\.\/runner"/);
});

// --- empty-state next-step copy (issue #725) -------------------------------

test("runner empty-state brand strings include both headline and next-step hint", () => {
  const src = read("src/config/brand/runner.ts");
  assert.match(src, /RUNNER_LIST_EMPTY_AVAILABLE\s*=\s*"[^"]+"/);
  assert.match(src, /RUNNER_LIST_EMPTY_AVAILABLE_HINT\s*=\s*"[^"]+"/);
  assert.match(src, /RUNNER_LIST_EMPTY_ACTIVE\s*=\s*"[^"]+"/);
  assert.match(src, /RUNNER_LIST_EMPTY_ACTIVE_HINT\s*=\s*"[^"]+"/);
});

test("RunnerCenterView renders the empty-state next-step hint alongside the bare label (#725)", () => {
  const src = read("src/features/runner/RunnerCenterView.vue");
  // Both empty branches must surface the hint copy, not just the headline.
  assert.match(src, /data-testid="runner-empty-available"[\s\S]*?RUNNER_LIST_EMPTY_AVAILABLE_HINT/);
  assert.match(src, /data-testid="runner-empty-active"[\s\S]*?RUNNER_LIST_EMPTY_ACTIVE_HINT/);
});
