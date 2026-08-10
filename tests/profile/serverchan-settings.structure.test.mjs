import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Structure tests for the Server酱 external notification settings + opt-in
 * dialogs (ps#504 I2).
 *
 * Runs as `node --test` (matches the repo's `*.structure.test.mjs` pattern).
 * Asserts that the new files declare the expected shape (composables, brand
 * constants, view boundaries, hard security boundary on the sendKey input).
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
}

// --- Brand constants ---

test("SERVERCHAN_* brand strings live in config/brand/serverchan.ts", () => {
  const src = read("src/config/brand/serverchan.ts");
  for (const key of [
    "SERVERCHAN_SECTION_LABEL",
    "SERVERCHAN_SECTION_HELPER",
    "SERVERCHAN_STATE_UNBOUND",
    "SERVERCHAN_STATE_BOUND",
    "SERVERCHAN_STATE_BOUND_DISABLED",
    "SERVERCHAN_BIND_BUTTON",
    "SERVERCHAN_BIND_MANUAL_LABEL",
    "SERVERCHAN_BIND_MANUAL_PLACEHOLDER",
    "SERVERCHAN_BIND_MANUAL_SUBMIT",
    "SERVERCHAN_UNBIND_BUTTON",
    "SERVERCHAN_UNBIND_CONFIRM",
    "SERVERCHAN_BIND_KEY_INVALID",
    "SERVERCHAN_TOGGLE_EVENT_START_LABEL",
    "SERVERCHAN_TOGGLE_REWARD_LABEL",
    "SERVERCHAN_DIALOG_EVENT_TITLE",
    "SERVERCHAN_DIALOG_EVENT_BODY",
    "SERVERCHAN_DIALOG_EVENT_PRIMARY",
    "SERVERCHAN_DIALOG_EVENT_SECONDARY",
    "SERVERCHAN_DIALOG_ERRAND_TITLE",
    "SERVERCHAN_DIALOG_ERRAND_BODY",
    "SERVERCHAN_DIALOG_ERRAND_PRIMARY",
    "SERVERCHAN_DIALOG_ERRAND_SECONDARY",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`), `${key} should be exported`);
  }
});

test("config/brand/index.ts re-exports the serverchan module", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /export \* from "\.\/serverchan"/);
});

// --- Privacy boilerplate copy ---
//
// The helper text under the section title is the privacy contract owed to
// every external-notification surface — LIAN does NOT push marketing notices
// via Server酱. The exact phrasing is part of the user-facing commitment.

test("privacy helper copy mentions both LIAN's commitment and the narrow purposes", () => {
  const src = read("src/config/brand/serverchan.ts");
  assert.match(src, /SERVERCHAN_SECTION_HELPER\s*=/);
  // No marketing notifications.
  assert.match(src, /不发送营销/);
  // Three explicit purposes: 活动关键变更 / 跑腿订单取消\/退款 / 主动开启的提醒.
  assert.match(src, /活动关键变更/);
  assert.match(src, /跑腿订单取消/);
  assert.match(src, /主动开启的提醒/);
});

// --- API client wires the I1-D + I1-E endpoints ---

test("api/serverchan exports the binding endpoints (I1-D)", () => {
  const src = read("src/api/serverchan.ts");
  assert.match(src, /fetchServerChanBinding/);
  assert.match(src, /fetchServerChanBindUrl/);
  assert.match(src, /bindServerChanWithSendKey/);
  assert.match(src, /unbindServerChan/);
  assert.match(src, /\/api\/notifications\/serverchan\/binding/);
  assert.match(src, /\/api\/notifications\/serverchan\/bind-url/);
});

test("api/serverchan exports the preferences endpoints (I1-E)", () => {
  const src = read("src/api/serverchan.ts");
  assert.match(src, /fetchServerChanPreferences/);
  assert.match(src, /updateServerChanPreferences/);
  assert.match(src, /setErrandOrderReminderPreference/);
  assert.match(src, /\/api\/notifications\/serverchan\/preferences/);
  assert.match(src, /preferences\/errand-order/);
});

test("api/serverchan binding GET response shape strips raw sendKey", () => {
  const src = read("src/api/serverchan.ts");
  // The ServerChanBinding interface MUST not have a sendKey field — the read
  // path never carries it. We pull out the interface body and assert the
  // sendKey identifier is absent there. The function-parameter `sendKey:
  // string` on `bindServerChanWithSendKey` is allowed (one outbound site).
  const ifaceMatch = src.match(/export interface ServerChanBinding \{[\s\S]*?\n\}/);
  assert.ok(ifaceMatch, "ServerChanBinding interface must exist");
  assert.doesNotMatch(ifaceMatch[0], /sendKey/);

  // Total mentions of the identifier across the file are bounded: the bind
  // function signature + the JSON.stringify body + the JSDoc block above.
  // More than that suggests a leak path we did not expect.
  const matches = src.match(/sendKey/g) || [];
  assert.ok(matches.length <= 5, `unexpected sendKey mentions in api: ${matches.length}`);
});

// --- Composables: useServerChanBinding ---

test("useServerChanBinding is the only place the sendKey ever lives", () => {
  const src = read("src/features/profile/useServerChanBinding.ts");
  assert.match(src, /export function useServerChanBinding/);
  assert.match(src, /manualKey\s*=\s*ref/);
  assert.match(src, /clearManualKey/);
  // Hard security boundary: the composable MUST clear the input after a
  // successful bind round-trip.
  assert.match(src, /clearManualKey\(\)/);
  // No console.log leaking the sendKey.
  assert.doesNotMatch(src, /console\.log\([^)]*sendKey/i);
});

test("useServerChanBinding maps BINDING_KEY_INVALID 400 to the 格式不正确 brand string", () => {
  const src = read("src/features/profile/useServerChanBinding.ts");
  assert.match(src, /BINDING_KEY_INVALID/);
  assert.match(src, /SERVERCHAN_BIND_KEY_INVALID/);
});

test("useServerChanBinding does NOT persist the sendKey to any storage backend", () => {
  const src = read("src/features/profile/useServerChanBinding.ts");
  // localStorage / sessionStorage / IndexedDB / cookie writes against the key
  // are non-negotiable forbidden.
  assert.doesNotMatch(src, /localStorage[\s\S]*sendKey/i);
  assert.doesNotMatch(src, /sessionStorage[\s\S]*sendKey/i);
  assert.doesNotMatch(src, /indexedDB[\s\S]*sendKey/i);
  assert.doesNotMatch(src, /document\.cookie[\s\S]*sendKey/i);
});

// --- Composables: useServerChanPreferences ---

test("useServerChanPreferences exposes load / toggle / setErrandOrderReminder", () => {
  const src = read("src/features/profile/useServerChanPreferences.ts");
  assert.match(src, /export function useServerChanPreferences/);
  assert.match(src, /async function load/);
  assert.match(src, /async function toggle/);
  assert.match(src, /async function setErrandOrderReminder/);
});

test("useServerChanPreferences reverts the optimistic flip on update failure", () => {
  const src = read("src/features/profile/useServerChanPreferences.ts");
  // Snapshot taken before the optimistic write; restored in the catch block.
  assert.match(src, /const before/);
  assert.match(src, /preferences\.value\s*=\s*before/);
});

// --- Composables: useServerChanOptIn ---

test("useServerChanOptIn gates both dialogs on bound === true", () => {
  const src = read("src/features/profile/useServerChanOptIn.ts");
  assert.match(src, /shouldOfferEventStart/);
  assert.match(src, /shouldOfferErrandOrder/);
  assert.match(src, /binding\.isBound\.value/);
});

test("useServerChanOptIn dismissal flag is in-memory only (no storage writes)", () => {
  const src = read("src/features/profile/useServerChanOptIn.ts");
  assert.match(src, /dismissedThisSession\s*=\s*new Set/);
  // Storage WRITES would persist the flag across reloads, which the issue
  // brief explicitly forbids. The word may still appear inside a comment
  // explaining the choice; we look for actual API calls instead.
  assert.doesNotMatch(src, /localStorage\s*\.\s*setItem/);
  assert.doesNotMatch(src, /sessionStorage\s*\.\s*setItem/);
  assert.doesNotMatch(src, /document\.cookie\s*=/);
});

test("useServerChanOptIn only triggers event-start prompt when current preference is false", () => {
  const src = read("src/features/profile/useServerChanOptIn.ts");
  // Skip if user already opted in to event-start reminders.
  assert.match(src, /eventStartingReminder/);
  assert.match(src, /current\.eventStartingReminder/);
});

// --- Settings block view ---

test("ProfileServerChanBlock imports composables only (no direct api import)", () => {
  const src = read("src/features/profile/ProfileServerChanBlock.vue");
  assert.match(src, /useServerChanBinding/);
  assert.match(src, /useServerChanPreferences/);
  // Layer purity: views must not reach into src/api/* directly. The boundary
  // guard `check-view-imports-composable.mjs` enforces this at npm run check.
  assert.doesNotMatch(src, /from\s+["']\.\.\/\.\.\/api\/serverchan/);
  assert.doesNotMatch(src, /from\s+["']src\/api\//);
});

test("ProfileServerChanBlock gates reminder toggles on bound === true && enabled === true", () => {
  const src = read("src/features/profile/ProfileServerChanBlock.vue");
  // The v-if for the toggles dl must require both bound + enabled.
  assert.match(src, /showReminderToggles/);
  assert.match(src, /isBound\.value/);
  assert.match(src, /isEnabled\.value/);
});

test("ProfileServerChanBlock manual-paste input is type=password + autocomplete=off", () => {
  const src = read("src/features/profile/ProfileServerChanBlock.vue");
  // The hard security boundary requires a masked input that is NOT remembered
  // by browser password managers.
  assert.match(src, /type="password"/);
  assert.match(src, /autocomplete="off"/);
});

test("ProfileServerChanBlock declares stable test ids for each control", () => {
  const src = read("src/features/profile/ProfileServerChanBlock.vue");
  for (const id of [
    "serverchan-settings-block",
    "serverchan-state-label",
    "serverchan-bind-button",
    "serverchan-manual-open",
    "serverchan-manual-form",
    "serverchan-manual-input",
    "serverchan-manual-submit",
    "serverchan-manual-cancel",
    "serverchan-unbind-button",
    "serverchan-toggle-event-start",
    "serverchan-toggle-reward",
    "serverchan-toggles",
    "serverchan-helper",
  ]) {
    assert.match(src, new RegExp(`data-testid="${id}"`));
  }
});

test("ProfileServerChanBlock requires two-step confirm before unbind (destructive action)", () => {
  const src = read("src/features/profile/ProfileServerChanBlock.vue");
  assert.match(src, /SERVERCHAN_UNBIND_CONFIRM/);
  assert.match(src, /unbindArmed/);
  assert.match(src, /armUnbind/);
  assert.match(src, /confirmUnbind/);
  // Native window.confirm() invocation is banned by scripts/guard-unsafe-dom-sinks.
  // (The string `window.confirm` may still appear in a comment explaining why.)
  assert.doesNotMatch(src, /window\.confirm\s*\(/);
});

// --- ProfileView mounts the new block ---

test("ProfileView mounts ProfileServerChanBlock only in the authenticated profile", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import ProfileServerChanBlock/);
  const authenticatedIdx = src.indexOf('<template v-else-if="user">');
  const serverchanIdx = src.indexOf("<ProfileServerChanBlock");
  const guestIdx = src.indexOf('<section v-else class="profile-view__guest">');
  assert.ok(authenticatedIdx > -1 && serverchanIdx > -1 && guestIdx > -1);
  assert.ok(authenticatedIdx < serverchanIdx, "ServerChan settings belong to signed-in profiles");
  assert.ok(serverchanIdx < guestIdx, "ServerChan settings must not mount in the guest branch");
  assert.match(
    src.slice(serverchanIdx, src.indexOf(">", serverchanIdx) + 1),
    /:is-authenticated="Boolean\(user\)"/,
  );
});

// --- Opt-in dialog component ---

test("ServerChanOptInDialog is a presentational component with primary/secondary intents", () => {
  const src = read("src/features/profile/ServerChanOptInDialog.vue");
  assert.match(src, /defineEmits<\{[\s\S]*primary[\s\S]*secondary/);
  assert.match(src, /data-testid="serverchan-optin-dialog"/);
  assert.match(src, /data-testid="serverchan-optin-primary"/);
  assert.match(src, /data-testid="serverchan-optin-secondary"/);
});

// --- Event-join + errand-create wiring ---

test("usePostDetailExtensions opens the event-start opt-in dialog on join (NOT cancel)", () => {
  const src = read("src/composables/usePostDetailExtensions.ts");
  assert.match(src, /useServerChanOptIn/);
  assert.match(src, /openEventStartDialog/);
  // Must check the transition direction — only on a fresh join.
  assert.match(src, /!wasJoined && joined/);
});

test("PostDetailPanel renders the event-start ServerChanOptInDialog", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  assert.match(src, /ServerChanOptInDialog/);
  assert.match(src, /SERVERCHAN_DIALOG_EVENT_TITLE/);
  assert.match(src, /serverChanOptIn\.state\.value\.kind === 'event-start'/);
});

test("ErrandOrderView opens the errand-order opt-in dialog after a successful submit", () => {
  const src = read("src/features/errand/ErrandOrderView.vue");
  assert.match(src, /useServerChanOptIn/);
  assert.match(src, /openErrandOrderDialog/);
  assert.match(src, /SERVERCHAN_DIALOG_ERRAND_TITLE/);
});

// --- No real secret in any new file ---

test("no real Server酱 SendKey patterns appear in any new source file", () => {
  // Real Server酱 keys look like SCT followed by a long alphanumeric run.
  // Tests use the explicit placeholder `SCT_TEST_PLACEHOLDER`.
  const realKeyPattern = /\bSCT[0-9]{6,}[A-Za-z0-9]{16,}\b/;
  const filesToScan = [
    "src/api/serverchan.ts",
    "src/config/brand/serverchan.ts",
    "src/features/profile/ProfileServerChanBlock.vue",
    "src/features/profile/ServerChanOptInDialog.vue",
    "src/features/profile/useServerChanBinding.ts",
    "src/features/profile/useServerChanPreferences.ts",
    "src/features/profile/useServerChanOptIn.ts",
  ];
  for (const file of filesToScan) {
    const src = read(file);
    assert.doesNotMatch(src, realKeyPattern, `real-looking SendKey in ${file}`);
  }
});

// --- No console.log of the sendKey anywhere ---

test("no console.log call mentions sendKey across new files", () => {
  const filesToScan = [
    "src/api/serverchan.ts",
    "src/features/profile/useServerChanBinding.ts",
    "src/features/profile/ProfileServerChanBlock.vue",
  ];
  for (const file of filesToScan) {
    const src = read(file);
    assert.doesNotMatch(src, /console\.log\([^)]*sendKey/i, `sendKey logged in ${file}`);
    assert.doesNotMatch(src, /console\.error\([^)]*sendKey/i, `sendKey logged in ${file}`);
    assert.doesNotMatch(src, /console\.warn\([^)]*sendKey/i, `sendKey logged in ${file}`);
  }
});
