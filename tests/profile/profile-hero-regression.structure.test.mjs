import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- ProfileView hero background ---

test("ProfileView has hero background gradient", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /profile-view__hero-bg/);
  assert.match(src, /linear-gradient/);
});

test("ProfileView hero gradient uses primary-soft token", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /var\(--lian-primary-soft\)/);
});

test("ProfileView does not use GlassPanel wrapper for hero", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.doesNotMatch(src, /<GlassPanel class="profile-view__card">/);
});

// --- ProfileView state machine ---

test("ProfileView handles three states: loading, logged-in, guest", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /v-if="loading"/);
  assert.match(src, /v-else-if="user"/);
  assert.match(src, /v-else/);
});

test("ProfileView renders guest AuthPanel without wrapper", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /profile-view__guest/);
  assert.match(src, /<AuthPanel/);
});

test("ProfileView renders ProfileEditorPanel for logged-in users", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /ProfileEditorPanel/);
  assert.match(src, /editorOpen/);
});

// --- ProfileView shell chrome contract ---

test("ProfileView imports useProfileChrome composable", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import.*useProfileChrome/);
  assert.match(src, /from.*\.\/useProfileChrome/);
});

test("useProfileChrome computes declarative PageChromeSpec", () => {
  const src = read("src/features/profile/useProfileChrome.ts");
  assert.match(src, /PageChromeSpec/);
  assert.match(src, /const pageChrome = computed<PageChromeSpec>/);
});

test("useProfileChrome includes editor toggle and logout actions", () => {
  const src = read("src/features/profile/useProfileChrome.ts");
  assert.match(src, /profile:toggle-editor/);
  assert.match(src, /profile:logout/);
});

// --- ProfileHeader hero layout ---

test("ProfileHeader has centered hero layout with large avatar", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /profile-header__hero/);
  assert.match(src, /profile-header__avatar/);
  assert.match(src, /justify-items:\s*center/);
});

test("ProfileHeader avatar is 80px orb", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /80px/);
});

test("ProfileHeader display name uses large bold style", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /profile-header__name/);
});

test("ProfileHeader does not use IdentityBadge", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.doesNotMatch(src, /<IdentityBadge/);
  assert.doesNotMatch(src, /import.*IdentityBadge/);
});

// --- ProfileTabs ---

test("ProfileTabs uses underline style with ARIA tablist", () => {
  const src = read("src/features/profile/ProfileTabs.vue");
  assert.match(src, /role="tablist"/);
  assert.match(src, /role="tab"/);
  assert.match(src, /aria-selected/);
});

test("ProfileTabs uses underline border style not chip radius", () => {
  const src = read("src/features/profile/ProfileTabs.vue");
  assert.match(src, /border-bottom.*2px.*transparent/);
  assert.doesNotMatch(src, /border-radius: var\(--radius-chip\)/);
});

// --- ProfileCollectionList ---

test("ProfileCollectionList cards use shadow not border", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /box-shadow: var\(--shadow-card\)/);
  assert.doesNotMatch(src, /border: 1px solid rgba\(31, 41, 51, 0\.08\)/);
});

// --- Profile layout mode ---

test("profile view uses content layout mode", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /profile:\s*"content"/);
});
