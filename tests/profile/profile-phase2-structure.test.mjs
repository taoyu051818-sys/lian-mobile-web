import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- ProfileHeader alias picker affordance ---

test("ProfileHeader accepts aliases prop for picker", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /aliases:\s*ProfileAlias\[\]/);
});

test("ProfileHeader accepts aliasPickerOpen prop", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /aliasPickerOpen:\s*boolean/);
});

test("ProfileHeader emits toggle-alias-picker event", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /"toggle-alias-picker"/);
});

test("ProfileHeader emits select-alias event with aliasId", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /"select-alias"/);
});

test("ProfileHeader alias card is clickable when multiple aliases exist", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /profile-header__alias-card--clickable/);
  assert.match(src, /hasMultipleAliases/);
});

test("ProfileHeader alias card has ARIA button semantics when clickable", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /role:\s*'button'/);
  assert.match(src, /tabindex:\s*0/);
  assert.match(src, /aria-expanded/);
  assert.match(src, /aria-haspopup.*listbox/);
});

test("ProfileHeader alias card supports keyboard activation", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /@keydown\.enter/);
  assert.match(src, /@keydown\.space/);
});

test("ProfileHeader shows alias count badge", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /profile-header__alias-count/);
  assert.match(src, /aliases\.length/);
});

test("ProfileHeader has inline alias picker with listbox role", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /profile-header__alias-picker/);
  assert.match(src, /role="listbox"/);
});

test("ProfileHeader alias picker options have option role and aria-selected", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /role="option"/);
  assert.match(src, /aria-selected/);
});

test("ProfileHeader alias picker includes real identity option", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /PROFILE_REAL_IDENTITY/);
  assert.match(src, /emit\('select-alias',\s*''\)/);
});

// --- ProfileCollectionList click-to-open ---

test("ProfileCollectionList emits open-item event", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /"open-item"/);
  assert.match(src, /FeedItemId/);
});

test("ProfileCollectionList items are keyboard-accessible interactive elements", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /role="button"/);
  assert.match(src, /tabindex="0"/);
  assert.match(src, /@keydown\.enter/);
  assert.match(src, /@keydown\.space/);
});

test("ProfileCollectionList items emit open-item on click", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /@click="emit\('open-item'/);
});

test("ProfileCollectionList items have interactive hover and focus styles", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /cursor:\s*pointer/);
  assert.match(src, /profile-collection__item:hover/);
  assert.match(src, /profile-collection__item:focus-visible/);
});

// --- ProfileView detail overlay integration ---

test("ProfileView imports ProfileDetailOverlay component", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import ProfileDetailOverlay/);
  assert.match(src, /from.*\.\/ProfileDetailOverlay\.vue/);
});

test("ProfileDetailOverlay imports PostDetailPanel", () => {
  const src = read("src/features/profile/ProfileDetailOverlay.vue");
  assert.match(src, /import\s+\{\s*PostDetailPanel\s*\}/);
  assert.match(src, /from.*\.\.\/detail/);
});

test("ProfileView wires detail through useDetailNavigation", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import.*useDetailNavigation/);
  assert.match(src, /from.*app\/detail-navigation/);
});

test("ProfileView reads detail state through the store's reactive computeds", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /detail\.detailOpen/);
  assert.match(src, /detail\.detailPost/);
  assert.match(src, /detail\.detailLoading/);
  assert.match(src, /detail\.detailError/);
});

test("ProfileView renders ProfileDetailOverlay conditionally when detail is open", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /<ProfileDetailOverlay/);
  assert.match(src, /v-if="detail\.detailOpen\.value"/);
});

test("ProfileView passes detail state to ProfileDetailOverlay", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /:post="detail\.detailPost\.value"/);
  assert.match(src, /:loading="detail\.detailLoading\.value"/);
  assert.match(src, /:error="detail\.detailError\.value"/);
  assert.match(src, /@close="detail\.close\(/);
  assert.match(src, /@retry="detail\.retry\(/);
});

test("ProfileView wires collection list open-item to detail opener", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /@open-item="openItem"/);
  assert.match(src, /detail\.open\(/);
});

test("detail-navigation reducer fetches via fetchPostDetail through the fetcher", () => {
  const src = read("src/app/detail-navigation/fetcher.ts");
  assert.match(src, /fetchPostDetail/);
  assert.match(src, /fetch-result/);
});

// --- ProfileDetailOverlay wrapper ---

test("ProfileDetailOverlay wraps PostDetailPanel in a dialog overlay", () => {
  const src = read("src/features/profile/ProfileDetailOverlay.vue");
  assert.match(src, /class="profile-view__detail-overlay"/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /aria-label/);
});

test("ProfileDetailOverlay has fixed positioning CSS", () => {
  const src = read("src/features/profile/ProfileDetailOverlay.vue");
  assert.match(src, /\.profile-view__detail-overlay/);
  assert.match(src, /position:\s*fixed/);
  assert.match(src, /inset:\s*0/);
  assert.match(src, /z-index:\s*30/);
});

// --- ProfileView alias switching ---

test("useProfileAliasPicker imports alias activation API functions", () => {
  const src = read("src/features/profile/useProfileAliasPicker.ts");
  assert.match(src, /activateProfileAlias/);
  assert.match(src, /deactivateProfileAlias/);
});

// Alias picker now lives inside ProfileIdentityGroup (PR-B). ProfileView only
// orchestrates load/error/guest/tabs/detail; the identity-related state stays
// behind one container so the four "identity" subcomponents share refs cleanly.

test("ProfileIdentityGroup manages alias picker open state", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /aliasPickerOpen/);
});

test("ProfileIdentityGroup passes aliases and picker state to ProfileHeader", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /:aliases="aliases"/);
  assert.match(src, /:alias-picker-open="aliasPickerOpen"/);
});

test("ProfileIdentityGroup wires alias picker toggle and select events", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /@toggle-alias-picker/);
  assert.match(src, /@select-alias="switchAlias"/);
});

test("useProfileAliasPicker has switchAlias function that calls activate/deactivate API", () => {
  const src = read("src/features/profile/useProfileAliasPicker.ts");
  assert.match(src, /async function switchAlias/);
  assert.match(src, /await activateProfileAlias/);
  assert.match(src, /await deactivateProfileAlias/);
});

// --- Phase-1 regression guards (should still pass) ---

test("ProfileView preserves hero background gradient", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /profile-view__hero-bg/);
  assert.match(src, /linear-gradient/);
});

test("ProfileView preserves three states: loading, logged-in, guest", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /v-if="loading"/);
  assert.match(src, /v-else-if="user"/);
  assert.match(src, /v-else/);
});

test("ProfileIdentityGroup preserves chrome spec via useProfileChrome composable", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /import.*useProfileChrome/);
  assert.match(src, /useProfileChrome\(/);
});

test("useProfileChrome preserves editor toggle and logout actions", () => {
  const src = read("src/features/profile/useProfileChrome.ts");
  assert.match(src, /profile:toggle-editor/);
  assert.match(src, /profile:logout/);
});

test("ProfileIdentityGroup preserves editor panel integration", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /ProfileEditorPanel/);
  assert.match(src, /editorOpen/);
});

test("ProfileHeader preserves centered hero layout", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  const css = read("src/features/profile/profile-header.css");
  assert.match(src, /profile-header__hero/);
  assert.match(css, /justify-items:\s*center/);
});

test("ProfileHeader preserves 80px avatar", () => {
  const css = read("src/features/profile/profile-header.css");
  assert.match(css, /80px/);
});

test("ProfileHeader preserves no IdentityBadge import", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.doesNotMatch(src, /<IdentityBadge/);
  assert.doesNotMatch(src, /import.*IdentityBadge/);
});

test("ProfileCollectionList preserves shadow card style", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /box-shadow: var\(--shadow-card\)/);
  assert.doesNotMatch(src, /border: 1px solid rgba\(31, 41, 51, 0\.08\)/);
});
