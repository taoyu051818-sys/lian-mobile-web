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

// --- ProfileSettingsBlock component shape ---

test("ProfileSettingsBlock loads on mount, optimistically applies, reverts on rejection", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  assert.match(src, /onMounted/);
  assert.match(src, /fetchProfileSettings/);
  assert.match(src, /patchProfileSettings/);
  // Optimistic update + revert on failure so the toggle / select feels immediate
  // and the UI never falls out of sync with /me/settings.
  assert.match(src, /const previous\s*=/);
  assert.match(src, /settings\.value\s*=\s*previous/);
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

test("ProfileSettingsBlock disables controls while saving and surfaces a save indicator", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  assert.match(src, /:disabled="saving"/);
  assert.match(src, /data-testid="profile-settings-saving"/);
  assert.match(src, /PROFILE_SETTINGS_SAVING/);
});

test("ProfileSettingsBlock surfaces load + patch error strings on failure paths", () => {
  const src = read("src/features/profile/ProfileSettingsBlock.vue");
  assert.match(src, /PROFILE_SETTINGS_LOAD_ERROR/);
  assert.match(src, /PROFILE_SETTINGS_PATCH_ERROR/);
  assert.match(src, /data-testid="profile-settings-error"/);
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
