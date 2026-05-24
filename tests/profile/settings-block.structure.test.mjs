import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- Types mirror backend ---

test("ProfileSettings type lists the three fields the backend emits", () => {
  const src = read("src/types/profile.ts");
  assert.match(src, /export interface ProfileSettings/);
  assert.match(src, /notificationEnabled:\s*boolean/);
  assert.match(src, /profileVisibility:\s*ProfileVisibility/);
  assert.match(src, /allowMessageMentions:\s*boolean/);
});

test("ProfileVisibility enumerates exactly the three backend values", () => {
  const src = read("src/types/profile.ts");
  assert.match(
    src,
    /export type ProfileVisibility\s*=\s*"public"\s*\|\s*"campus"\s*\|\s*"private"/,
  );
});

test("ProfileSettingsPatch is Partial<ProfileSettings>", () => {
  const src = read("src/types/profile.ts");
  assert.match(src, /export type ProfileSettingsPatch\s*=\s*Partial<ProfileSettings>/);
});

// --- API client wires GET + PATCH ---

test("fetchProfileSettings hits GET /api/me/settings", () => {
  const src = read("src/api/profile.ts");
  assert.match(src, /export async function fetchProfileSettings/);
  assert.match(src, /apiGet<ProfileSettings>\("\/api\/me\/settings"\)/);
});

test("patchProfileSettings issues PATCH /api/me/settings with the patch in the body", () => {
  const src = read("src/api/profile.ts");
  assert.match(src, /export async function patchProfileSettings/);
  assert.match(src, /method:\s*"PATCH"/);
  assert.match(src, /JSON\.stringify\(patch\)/);
});

// --- settings-state FSM three-piece structure ---
//
// Mirrors the detail-navigation FSM landed in #628. The settings block was
// rewritten on top of this pattern so that optimistic update + rollback live
// in a pure reducer (testable as data) rather than scattered across four
// component-local refs.

test("settings-state state.ts defines the four-state discriminated union", () => {
  const src = read("src/features/profile/settings-state/state.ts");
  assert.match(src, /export type SettingsState/);
  for (const kind of ["idle", "loading", "ready", "saving", "error"]) {
    assert.match(src, new RegExp(`kind:\\s*"${kind}"`));
  }
});

test("settings-state state.ts gates fetch/patch result on token === current state token", () => {
  // The whole point of the rewrite — stale results dropped by reducer, not by
  // a `disabled` guard on the controls.
  const src = read("src/features/profile/settings-state/state.ts");
  assert.match(src, /action\.token\s*!==\s*state\.token/);
});

test("settings-state state.ts captures `previous` snapshot when entering saving (rollback target)", () => {
  const src = read("src/features/profile/settings-state/state.ts");
  // Entering saving must snapshot the pre-optimistic value so a rejected PATCH
  // rolls back to it rather than to whatever the UI happens to show now.
  assert.match(src, /previous:\s*state\.settings/);
});

test("settings-state fetcher dispatches load-result + patch-result with the original token", () => {
  const src = read("src/features/profile/settings-state/fetcher.ts");
  assert.match(src, /fetchSettingsWithToken/);
  assert.match(src, /patchSettingsWithToken/);
  assert.match(src, /type:\s*"load-result"/);
  assert.match(src, /type:\s*"patch-result"/);
});

test("settings-state store exposes useProfileSettings with three command verbs", () => {
  const src = read("src/features/profile/settings-state/store.ts");
  assert.match(src, /export function useProfileSettings/);
  for (const verb of ["load\\(\\)", "patch\\(p:", "retry\\(\\)"]) {
    assert.match(src, new RegExp(verb));
  }
});

test("settings-state store provides test-only handlers + reset hook (mirrors #628)", () => {
  const src = read("src/features/profile/settings-state/store.ts");
  assert.match(src, /__setEffectHandlersForTesting/);
  assert.match(src, /__resetStoreForTesting/);
});

test("settings-state index re-exports the public surface only", () => {
  const src = read("src/features/profile/settings-state/index.ts");
  assert.match(src, /export\s+\{\s*useProfileSettings/);
  assert.match(src, /export type \{[^}]*ProfileSettingsView/);
});

// --- ProfileSettingsBlock component shape ---

test("ProfileSettingsBlock consumes settings-state via useProfileSettings (no parallel refs)", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  assert.match(src, /import\s*\{[^}]*useProfileSettings[^}]*\}\s*from\s*"\.\/settings-state"/);
  // The four parallel refs from the original cut (settings/loading/saving/error)
  // must be gone — that was the shape #628 collapsed for detail navigation.
  assert.doesNotMatch(src, /const\s+settings\s*=\s*ref</);
  assert.doesNotMatch(src, /const\s+loading\s*=\s*ref/);
  assert.doesNotMatch(src, /const\s+saving\s*=\s*ref/);
  assert.doesNotMatch(src, /const\s+errorMessage\s*=\s*ref/);
});

test("ProfileSettingsBlock loads on mount and dispatches patch through the FSM", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  assert.match(src, /onMounted/);
  assert.match(src, /settings\.load\(\)/);
  assert.match(src, /settings\.patch\(\{/);
  // No more local optimistic / rollback book-keeping — the reducer owns it.
  assert.doesNotMatch(src, /const previous\s*=/);
});

test("ProfileSettingsBlock exposes a row + control test id for each setting", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  assert.match(src, /data-testid="profile-settings-block"/);
  for (const setting of ["notificationEnabled", "profileVisibility", "allowMessageMentions"]) {
    assert.match(src, new RegExp(`data-setting="${setting}"`));
  }
  assert.match(src, /data-testid="profile-settings-notification"/);
  assert.match(src, /data-testid="profile-settings-visibility"/);
  assert.match(src, /data-testid="profile-settings-mentions"/);
});

test("ProfileSettingsBlock surfaces all three visibility options the backend accepts", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  for (const value of ["public", "campus", "private"]) {
    assert.match(src, new RegExp(`value:\\s*"${value}"`));
  }
});

test("ProfileSettingsBlock keeps controls interactive while saving (optimistic) and surfaces a save indicator", () => {
  // Modern-product feel: the toggle/select flips immediately on click, the
  // PATCH races in the background, and a rejected response rolls the value
  // back via the reducer's `previous` snapshot. We deliberately do NOT
  // disable the controls — the FSM already drops stale `patch-result`s by
  // token, so the only thing `:disabled` was buying was a "saving…" feel
  // that turned every toggle into a 200ms wait.
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  assert.doesNotMatch(src, /:disabled="settings\.saving\.value"/);
  assert.match(src, /data-testid="profile-settings-saving"/);
  assert.match(src, /PROFILE_SETTINGS_SAVING/);
});

test("ProfileSettingsBlock surfaces error message + retry only on load failure", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  // Error string is derived inside the FSM and pulled out via errorMessage.
  assert.match(src, /settings\.errorMessage\.value/);
  assert.match(src, /data-testid="profile-settings-error"/);
  // Retry button only appears for the "we have nothing to show" case
  // (load error, no prior ready snapshot). Patch errors keep the UI on the
  // rolled-back value so a retry button there would be confusing.
  assert.match(src, /settings\.errorPhase\.value === 'load'/);
});

// --- ProfileView mounts the block under stats, above tabs ---

test("ProfileView mounts ProfileSettingsBlock between stats and tabs", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import ProfileSettingsBlock/);
  assert.match(src, /<ProfileSettingsBlock \/>/);
  const statsIdx = src.indexOf("<ProfileStatsBlock");
  const settingsIdx = src.indexOf("<ProfileSettingsBlock");
  const tabsIdx = src.indexOf("<ProfileTabs");
  assert.ok(statsIdx > -1 && settingsIdx > -1 && tabsIdx > -1, "all three should be present");
  assert.ok(statsIdx < settingsIdx, "settings sits below stats");
  assert.ok(settingsIdx < tabsIdx, "settings sits above tabs");
});

// --- Brand strings registered ---

test("PROFILE_SETTINGS_* strings live in config/brand/profile.ts", () => {
  const src = read("src/config/brand/profile.ts");
  for (const key of [
    "PROFILE_SETTINGS_SECTION_LABEL",
    "PROFILE_SETTINGS_NOTIFICATION_LABEL",
    "PROFILE_SETTINGS_NOTIFICATION_HINT",
    "PROFILE_SETTINGS_VISIBILITY_LABEL",
    "PROFILE_SETTINGS_VISIBILITY_HINT",
    "PROFILE_SETTINGS_VISIBILITY_PUBLIC",
    "PROFILE_SETTINGS_VISIBILITY_CAMPUS",
    "PROFILE_SETTINGS_VISIBILITY_PRIVATE",
    "PROFILE_SETTINGS_MENTIONS_LABEL",
    "PROFILE_SETTINGS_MENTIONS_HINT",
    "PROFILE_SETTINGS_LOAD_ERROR",
    "PROFILE_SETTINGS_PATCH_ERROR",
    "PROFILE_SETTINGS_SAVING",
    "PROFILE_SETTINGS_RELOAD",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`));
  }
});
