import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
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
  assert.match(src, /:role="itemStates\[index\]\?\.canOpen \? 'button' : undefined"/);
  assert.match(src, /:tabindex="itemStates\[index\]\?\.canOpen \? 0 : undefined"/);
  assert.match(src, /@keydown\.enter/);
  assert.match(src, /@keydown\.space/);
  assert.match(src, /function canOpen\(item: ProfileListItem\)/);
});

test("ProfileCollectionList emits open-item through its guarded click handler", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /@click="openItem\(item\)"/);
  assert.match(
    src,
    /function openItem\(item: ProfileListItem\)\s*\{[\s\S]*?if \(!canOpen\(item\)[\s\S]*?emit\("open-item", item\.tid\)/,
  );
});

test("ProfileCollectionList items have interactive hover and focus styles", () => {
  const src = read("src/features/profile/ProfileCollectionList.vue");
  assert.match(src, /cursor:\s*pointer/);
  assert.match(src, /profile-collection__item:hover/);
  assert.match(src, /profile-collection__item:focus-visible/);
});

// --- ProfileView detail integration (post-#636: detail is App-level) ---

test("ProfileView no longer imports ProfileDetailOverlay (detail lives in App-level DetailSurface)", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.doesNotMatch(src, /ProfileDetailOverlay/);
});

test("ProfileDetailOverlay component file is removed; App-level DetailSurface owns the panel", () => {
  assert.doesNotMatch(
    fs.readdirSync(path.join(repoRoot, "src/features/profile")).join("\n"),
    /ProfileDetailOverlay\.vue/,
  );
});

test("ProfileView wires detail through useDetailNavigation", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import.*useDetailNavigation/);
  assert.match(src, /from.*app\/detail-navigation/);
});

test("ProfileView opens items through the detail-navigation store", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /detail\.open\(/);
});

test("ProfileView wires collection list open-item to detail opener", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /@open-item="openItem"/);
});

test("ProfileView does not mount PostDetailPanel locally", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.doesNotMatch(src, /<PostDetailPanel/);
});

test("detail-navigation reducer fetches via fetchPostDetail through the fetcher", () => {
  const src = read("src/app/detail-navigation/fetcher.ts");
  assert.match(src, /fetchPostDetail/);
  assert.match(src, /fetch-result/);
});

// --- App-level detail surface (issue #636) ---

test("App-level DetailSurface owns the post-detail dialog overlay", () => {
  const src = read("src/app/DetailSurface.vue");
  assert.match(src, /PostDetailPanel/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /<Teleport to="body">/);
});

test("App.vue mounts DetailSurface alongside the shell", () => {
  const src = read("src/App.vue");
  assert.match(src, /DetailSurface/);
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
