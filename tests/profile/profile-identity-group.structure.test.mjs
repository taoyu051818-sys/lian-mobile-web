import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

const SRC = "src/features/profile/ProfileIdentityGroup.vue";

// --- Container shape ---
//
// ProfileIdentityGroup is the first "lens" of the 4-lens profile layout
// (identity / creator / reader / inbox). It owns the four identity-related
// subcomponents plus the verification-center entry, sharing composable state
// (alias picker + chrome) across them so ProfileView can shrink to an
// orchestrator role.

test("ProfileIdentityGroup imports the four identity subcomponents it owns", () => {
  const src = read(SRC);
  for (const cmp of [
    "ProfileHeader",
    "ProfileEditorPanel",
    "ProfileStatsBlock",
    "ProfileSettingsBlock",
  ]) {
    assert.match(src, new RegExp(`import ${cmp} from "\\.\\/${cmp}\\.vue"`));
  }
});

test("ProfileIdentityGroup declares user / loadProfile / onLogout props", () => {
  const src = read(SRC);
  assert.match(src, /defineProps<\{[\s\S]*?user:\s*ProfileUser/);
  assert.match(src, /loadProfile:\s*\(\)\s*=>\s*Promise<void>/);
  assert.match(src, /onLogout:\s*\(\)\s*=>\s*void/);
});

test("ProfileIdentityGroup emits chrome and enter-verification events", () => {
  const src = read(SRC);
  assert.match(src, /defineEmits<\{[\s\S]*?chrome:\s*\[spec:\s*PageChromeSpec\]/);
  assert.match(src, /"enter-verification":\s*\[\]/);
});

test("ProfileIdentityGroup wraps the prop in a local ref so composables get Ref<ProfileUser | null>", () => {
  const src = read(SRC);
  assert.match(src, /const\s+userRef\s*=\s*ref\(props\.user\)/);
  assert.match(src, /watch\(\s*\(\)\s*=>\s*props\.user/);
});

test("ProfileIdentityGroup owns editorOpen state (moved out of ProfileView)", () => {
  const src = read(SRC);
  assert.match(src, /const\s+editorOpen\s*=\s*ref\(false\)/);
});

// --- Composable wiring ---

test("ProfileIdentityGroup wires useProfileAliasPicker with userRef + loadProfile closure", () => {
  const src = read(SRC);
  assert.match(src, /import.*useProfileAliasPicker/);
  assert.match(src, /useProfileAliasPicker\(\s*\{[\s\S]*?user:\s*userRef/);
  assert.match(src, /loadProfile:\s*\(\)\s*=>\s*props\.loadProfile\(\)/);
});

test("ProfileIdentityGroup wires useProfileChrome with editorOpen + emit forwarding", () => {
  const src = read(SRC);
  assert.match(src, /import.*useProfileChrome/);
  assert.match(src, /useProfileChrome\(\s*\{[\s\S]*?user:\s*userRef/);
  assert.match(src, /editorOpen,/);
  assert.match(src, /onLogout:\s*\(\)\s*=>\s*props\.onLogout\(\)/);
  assert.match(src, /onChromeChange:\s*\(spec\)\s*=>\s*emit\("chrome",\s*spec\)/);
});

// --- Subcomponent mount order ---

test("ProfileIdentityGroup mounts subcomponents in order: header → editor → stats → settings → verification", () => {
  const src = read(SRC);
  const headerIdx = src.indexOf("<ProfileHeader");
  const editorIdx = src.indexOf("<ProfileEditorPanel");
  const statsIdx = src.indexOf("<ProfileStatsBlock");
  const settingsIdx = src.indexOf("<ProfileSettingsBlock");
  const verificationIdx = src.indexOf("profile-identity-group__verification");
  assert.ok(headerIdx > -1, "header present");
  assert.ok(editorIdx > -1, "editor present");
  assert.ok(statsIdx > -1, "stats present");
  assert.ok(settingsIdx > -1, "settings present");
  assert.ok(verificationIdx > -1, "verification entry present");
  assert.ok(headerIdx < editorIdx, "header above editor");
  assert.ok(editorIdx < statsIdx, "editor above stats");
  assert.ok(statsIdx < settingsIdx, "stats above settings");
  assert.ok(settingsIdx < verificationIdx, "settings above verification entry");
});

test("ProfileIdentityGroup gates the editor panel on editorOpen", () => {
  const src = read(SRC);
  assert.match(src, /<ProfileEditorPanel\s+v-if="editorOpen"/);
});

test("ProfileIdentityGroup wires ProfileHeader alias-picker emits to local handlers", () => {
  const src = read(SRC);
  assert.match(src, /@toggle-alias-picker="aliasPickerOpen\s*=\s*!aliasPickerOpen"/);
  assert.match(src, /@select-alias="switchAlias"/);
});

test("ProfileIdentityGroup forwards profile updates from the editor panel", () => {
  const src = read(SRC);
  assert.match(src, /@updated="handleProfileUpdated"/);
});

// --- Verification-center footer ---

test("ProfileIdentityGroup renders the verification-center entry button", () => {
  const src = read(SRC);
  assert.match(src, /VERIFICATION_ENTER_LABEL/);
  assert.match(src, /import.*VERIFICATION_ENTER_LABEL.*from\s*"\.\.\/\.\.\/config\/brand"/);
  assert.match(src, /data-testid="profile-identity-group-verification"/);
  assert.match(src, /@click="emit\('enter-verification'\)"/);
});

// --- ProfileView no longer carries identity-related state ---

test("ProfileView no longer imports the four identity subcomponents directly", () => {
  const src = read("src/features/profile/ProfileView.vue");
  for (const cmp of [
    "ProfileHeader",
    "ProfileEditorPanel",
    "ProfileStatsBlock",
    "ProfileSettingsBlock",
  ]) {
    assert.doesNotMatch(src, new RegExp(`import ${cmp} from "\\.\\/${cmp}\\.vue"`));
  }
});

test("ProfileView no longer references editorOpen, aliasPickerOpen, or useProfileChrome", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.doesNotMatch(src, /editorOpen/);
  assert.doesNotMatch(src, /aliasPickerOpen/);
  assert.doesNotMatch(src, /useProfileChrome/);
  assert.doesNotMatch(src, /useProfileAliasPicker/);
});

test("ProfileView no longer renders the verification-entry footer (lives in IdentityGroup now)", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.doesNotMatch(src, /profile-view__verification-entry/);
  assert.doesNotMatch(src, /profile-view__verification-link/);
  assert.doesNotMatch(src, /VERIFICATION_ENTER_LABEL/);
});

test("ProfileView mounts ProfileIdentityGroup with the documented prop + emit chain", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /<ProfileIdentityGroup/);
  assert.match(src, /:user="user"/);
  assert.match(src, /:load-profile="loadProfile"/);
  assert.match(src, /:on-logout="logout"/);
  assert.match(src, /@chrome="\(spec\)\s*=>\s*emit\('chrome',\s*spec\)"/);
  assert.match(src, /@enter-verification="setActiveView\('verification'\)"/);
});
