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
  assert.match(src, /import PostDetailPanel/);
  assert.match(src, /from.*\.\/detail\/PostDetailPanel\.vue/);
});

test("ProfileView uses usePostDetail composable", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import.*usePostDetail/);
  assert.match(src, /from.*\.\/detail\/usePostDetail/);
});

test("ProfileView destructures detail state from usePostDetail", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /selectedPostId/);
  assert.match(src, /selectedPost/);
  assert.match(src, /detailLoading/);
  assert.match(src, /detailError/);
  assert.match(src, /detailOpen/);
});

test("ProfileView renders ProfileDetailOverlay conditionally when detail is open", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /<ProfileDetailOverlay/);
  assert.match(src, /v-if="detailOpen"/);
});

test("ProfileView passes detail state to ProfileDetailOverlay", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /:post="selectedPost"/);
  assert.match(src, /:loading="detailLoading"/);
  assert.match(src, /:error="detailError"/);
  assert.match(src, /@close="closeDetail"/);
  assert.match(src, /@retry="retryDetail"/);
});

test("ProfileView wires collection list open-item to detail opener", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /@open-item="openItem"/);
});

test("usePostDetail has openDetail function that calls fetchPostDetail", () => {
  const src = read("src/features/detail/usePostDetail.ts");
  assert.match(src, /async function openDetail/);
  assert.match(src, /await fetchPostDetail\(/);
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

test("usePostDetail saves scroll position when opening detail", () => {
  const src = read("src/features/detail/usePostDetail.ts");
  assert.match(src, /savedScrollY/);
  assert.match(src, /window\.scrollY/);
});

test("usePostDetail restores scroll position when closing detail", () => {
  const src = read("src/features/detail/usePostDetail.ts");
  assert.match(src, /requestAnimationFrame/);
  assert.match(src, /window\.scrollTo.*savedScrollY/);
});

test("usePostDetail initializes savedScrollY ref", () => {
  const src = read("src/features/detail/usePostDetail.ts");
  assert.match(src, /const savedScrollY = ref\(0\)/);
});

// --- ProfileView alias switching ---

test("useProfileAliasPicker imports alias activation API functions", () => {
  const src = read("src/features/profile/useProfileAliasPicker.ts");
  assert.match(src, /activateProfileAlias/);
  assert.match(src, /deactivateProfileAlias/);
});

test("ProfileView manages alias picker open state", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /aliasPickerOpen/);
});

test("ProfileView passes aliases and picker state to ProfileHeader", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /:aliases="aliases"/);
  assert.match(src, /:alias-picker-open="aliasPickerOpen"/);
});

test("ProfileView wires alias picker toggle and select events", () => {
  const src = read("src/features/profile/ProfileView.vue");
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

test("ProfileView preserves chrome spec via useProfileChrome composable", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import.*useProfileChrome/);
  assert.match(src, /useProfileChrome\(/);
});

test("useProfileChrome preserves editor toggle and logout actions", () => {
  const src = read("src/features/profile/useProfileChrome.ts");
  assert.match(src, /profile:toggle-editor/);
  assert.match(src, /profile:logout/);
});

test("ProfileView preserves editor panel integration", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /ProfileEditorPanel/);
  assert.match(src, /editorOpen/);
});

test("ProfileHeader preserves centered hero layout", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /profile-header__hero/);
  assert.match(src, /justify-items:\s*center/);
});

test("ProfileHeader preserves 80px avatar", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /80px/);
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
