import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
}

function openingTag(source, component) {
  const match = source.match(new RegExp(`<${component}\\b[\\s\\S]*?>`));
  assert.ok(match, `${component} opening tag should exist`);
  return match[0];
}

// --- Types: ProfilePostsContentFilter ---

test("ProfilePostsContentFilter union matches the backend presentationIntent values we surface", () => {
  const src = read("src/types/profile.ts");
  // Posts tab filter only; "all" means do-not-send-the-query.
  // Backend (profile-activity-service.js) accepts ?presentationIntent=
  // for merchant / trade / help. Event filter is deferred (#611 followup —
  // event posts ride metadata.event, not a presentationIntent).
  assert.match(
    src,
    /export type ProfilePostsContentFilter\s*=\s*"all"\s*\|\s*"merchant"\s*\|\s*"trade"\s*\|\s*"help"/,
  );
});

// --- API client: query param wiring ---

test("resolveProfileTabRequest forwards posts contentFilter as ?presentationIntent=", () => {
  const src = read("src/api/profile.ts");
  // The exported helper accepts an options bag carrying the filter; the
  // posts branch builds a path with the presentationIntent search param.
  // "all" is the sentinel that suppresses the query.
  assert.match(
    src,
    /export interface ProfileTabRequestOptions[\s\S]*contentFilter\?\s*:\s*ProfilePostsContentFilter/,
  );
  assert.match(src, /presentationIntent=\$\{encodeURIComponent\(filter\)\}/);
});

test("fetchProfileTab forwards an options bag carrying the contentFilter", () => {
  const src = read("src/api/profile.ts");
  assert.match(
    src,
    /export async function fetchProfileTab\b[\s\S]*?options:\s*ProfileTabRequestOptions/,
  );
});

// --- Composable: useProfileTabs threads the filter through ---

test("useProfileTabs exposes a postsContentFilter ref and threads it through loadProfileList", () => {
  const src = read("src/features/profile/useProfileTabs.ts");
  assert.match(src, /postsContentFilter/);
  assert.match(src, /ProfilePostsContentFilter/);
  // The fetcher must receive whatever filter is currently active when the
  // user is on the posts tab; non-posts tabs ignore it.
  assert.match(src, /fetchProfileTabWithSessionRefresh|fetchProfileTab/);
});

// --- Component: ProfilePostsContentFilter.vue ---

test("ProfilePostsContentFilter.vue renders one radio per filter option", () => {
  const src = read("src/features/profile/ProfilePostsContentFilter.vue");
  assert.match(src, /role="radiogroup"/);
  assert.match(src, /role="radio"/);
  // A content filter is a single-choice control, so the active chip exposes
  // the radio-state contract rather than relying on tab semantics.
  assert.match(src, /:aria-checked="modelValue === chip\.value"/);
  // The chip strip is a v-for over a static descriptor list. Assert the
  // descriptor list enumerates every supported filter value, plus the data
  // attribute the structure / e2e tests can target.
  for (const value of ["all", "merchant", "trade", "help"]) {
    assert.match(src, new RegExp(`value:\\s*"${value}"`));
  }
  assert.match(src, /:data-filter-value="chip\.value"/);
  assert.match(src, /data-testid="profile-posts-content-filter"/);
  assert.match(src, /data-testid="profile-posts-content-filter-chip"/);
});

test("ProfilePostsContentFilter emits the picked value through a typed event", () => {
  const src = read("src/features/profile/ProfilePostsContentFilter.vue");
  assert.match(src, /defineEmits/);
  assert.match(src, /select.*ProfilePostsContentFilter|select.*\[value:/);
});

// --- ProfileView wires the chip strip above the collection list, only on the posts tab ---

test("ProfileView mounts ProfilePostsContentFilter only when the posts tab is active", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import ProfilePostsContentFilter/);
  // Gate on the active tab — chip strip must not appear on history / saved /
  // liked / replies / drafts / map / orders.
  const tag = openingTag(src, "ProfilePostsContentFilter");
  assert.match(tag, /v-if="activeTab === 'posts'"/);
  assert.match(tag, /:model-value="postsContentFilter"/);
  assert.match(tag, /@select="selectPostsContentFilter"/);
});

// --- Brand strings registered in config/brand/profile.ts ---

test("PROFILE_POSTS_CONTENT_FILTER_* labels live in config/brand/profile.ts", () => {
  const src = read("src/config/brand/profile.ts");
  for (const key of [
    "PROFILE_POSTS_CONTENT_FILTER_LABEL",
    "PROFILE_POSTS_CONTENT_FILTER_ALL",
    "PROFILE_POSTS_CONTENT_FILTER_MERCHANT",
    "PROFILE_POSTS_CONTENT_FILTER_TRADE",
    "PROFILE_POSTS_CONTENT_FILTER_HELP",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`));
  }
});
