import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ProfileView uses hero background gradient instead of single GlassPanel wrapper", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /profile-view__hero-bg/);
  assert.match(src, /linear-gradient/);
  assert.doesNotMatch(src, /<GlassPanel class="profile-view__card">/);
});

test("ProfileView renders guest AuthPanel without GlassPanel wrapper", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /profile-view__guest/);
  assert.match(src, /<AuthPanel @authenticated="handleAuthenticated"/);
});

test("ProfileHeader uses centered hero layout with large avatar", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /profile-header__hero/);
  assert.match(src, /profile-header__avatar/);
  assert.match(src, /profile-header__name/);
  assert.match(src, /justify-items: center/);
});

test("ProfileHeader does not use IdentityBadge component", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.doesNotMatch(src, /<IdentityBadge/);
  assert.doesNotMatch(src, /import.*IdentityBadge/);
});

test("ProfileTabs uses underline tab style with role=tablist", () => {
  const src = read("src/features/profile/ProfileTabs.vue");
  assert.match(src, /role="tablist"/);
  assert.match(src, /role="tab"/);
  assert.match(src, /aria-selected/);
  assert.match(src, /border-bottom.*2px.*transparent/);
  assert.doesNotMatch(src, /border-radius: var\(--radius-chip\)/);
});

test("ProfileCollectionList cards use shadow instead of border", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /box-shadow: var\(--shadow-card\)/);
  assert.doesNotMatch(src, /border: 1px solid rgba\(31, 41, 51, 0\.08\)/);
});

// Chrome composable moved into ProfileIdentityGroup in PR-B (the four "identity"
// blocks share state via composables there). ProfileView only forwards the
// chrome emit up to AppViewHost.
test("ProfileIdentityGroup imports useProfileChrome composable", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /import.*useProfileChrome/);
  assert.match(src, /from.*\.\/useProfileChrome/);
});

test("useProfileChrome computes declarative PageChromeSpec with actions", () => {
  const src = read("src/features/profile/useProfileChrome.ts");
  assert.match(src, /PageChromeSpec/);
  assert.match(src, /const pageChrome = computed<PageChromeSpec>/);
  assert.match(src, /profile:toggle-editor/);
  assert.match(src, /profile:logout/);
});

test("ProfileView preserves the loading / logged-in / guest tri-state", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /v-if="loading"/);
  assert.match(src, /v-else-if="user"/);
  assert.match(src, /v-else.*profile-view__guest/);
});

// Editor panel + editorOpen state moved into ProfileIdentityGroup in PR-B.
test("ProfileIdentityGroup owns editorOpen and renders ProfileEditorPanel", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /editorOpen/);
  assert.match(src, /ProfileEditorPanel/);
});
