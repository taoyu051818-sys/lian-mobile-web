import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- ProfileStats type mirrors backend DEFAULT_PROFILE_STATS ---

test("ProfileStats type lists all six count fields the backend emits", () => {
  const src = read("src/types/profile.ts");
  assert.match(src, /export interface ProfileStats/);
  // Must mirror lian-platform-server profile-service.js DEFAULT_PROFILE_STATS.
  for (const field of ["posts", "replies", "saved", "liked", "drafts", "mapContributions"]) {
    assert.match(src, new RegExp(`${field}:\\s*number`));
  }
});

// --- API client wires GET /api/me/stats ---

test("fetchProfileStats hits GET /api/me/stats and returns ProfileStats", () => {
  const src = read("src/api/profile.ts");
  assert.match(src, /export async function fetchProfileStats/);
  assert.match(src, /apiGet<ProfileStats>\("\/api\/me\/stats"\)/);
});

// --- ProfileStatsBlock component shape ---

test("ProfileStatsBlock loads stats on mount and exposes a reload affordance", () => {
  const src = read("src/features/profile/ProfileStatsBlock.vue");
  assert.match(src, /onMounted/);
  assert.match(src, /fetchProfileStats/);
  // Reload button surfaces on the error path so the user has a way back in
  // when /api/me/stats degrades to safe defaults.
  assert.match(src, /PROFILE_STATS_RELOAD/);
  assert.match(src, /PROFILE_STATS_LOAD_ERROR/);
});

test("ProfileStatsBlock renders one cell per backend stat with a data-stat attribute", () => {
  const src = read("src/features/profile/ProfileStatsBlock.vue");
  assert.match(src, /data-testid="profile-stats-block"/);
  assert.match(src, /data-testid="profile-stats-grid"/);
  for (const stat of ["posts", "replies", "saved", "liked", "mapContributions", "drafts"]) {
    assert.match(src, new RegExp(`data-stat="${stat}"`));
  }
});

test("ProfileStatsBlock surfaces the rewards placeholder per PRD §N3 / 04_DECISIONS", () => {
  const src = read("src/features/profile/ProfileStatsBlock.vue");
  // Reward ledger is deferred server-side; PRD calls for a "敬请期待" placeholder.
  assert.match(src, /data-testid="profile-rewards-placeholder"/);
  assert.match(src, /PROFILE_REWARDS_PLACEHOLDER/);
  assert.match(src, /PROFILE_REWARDS_POINTS_LABEL/);
  assert.match(src, /PROFILE_REWARDS_HONORS_LABEL/);
});

// --- ProfileIdentityGroup mounts the block above the verification footer ---
//
// Stats moved into ProfileIdentityGroup in PR-B (the four "identity" blocks share
// composables there). ProfileView no longer references stats directly.

test("ProfileIdentityGroup mounts ProfileStatsBlock between editor panel and settings", () => {
  const src = read("src/features/profile/ProfileIdentityGroup.vue");
  assert.match(src, /import ProfileStatsBlock/);
  assert.match(src, /<ProfileStatsBlock \/>/);
  const blockIdx = src.indexOf("<ProfileStatsBlock");
  const editorIdx = src.indexOf("<ProfileEditorPanel");
  const settingsIdx = src.indexOf("<ProfileSettingsBlock");
  assert.ok(editorIdx > -1 && blockIdx > -1 && settingsIdx > -1, "all three should be present");
  assert.ok(editorIdx < blockIdx, "stats block sits below editor panel");
  assert.ok(blockIdx < settingsIdx, "stats block sits above settings block");
});

// --- Brand strings registered ---

test("PROFILE_STATS_* and PROFILE_REWARDS_* strings live in config/brand/profile.ts", () => {
  const src = read("src/config/brand/profile.ts");
  for (const key of [
    "PROFILE_STATS_SECTION_LABEL",
    "PROFILE_STATS_POSTS",
    "PROFILE_STATS_REPLIES",
    "PROFILE_STATS_SAVED",
    "PROFILE_STATS_LIKED",
    "PROFILE_STATS_MAP_CONTRIBUTIONS",
    "PROFILE_STATS_DRAFTS",
    "PROFILE_STATS_LOAD_ERROR",
    "PROFILE_STATS_RELOAD",
    "PROFILE_REWARDS_SECTION_LABEL",
    "PROFILE_REWARDS_POINTS_LABEL",
    "PROFILE_REWARDS_HONORS_LABEL",
    "PROFILE_REWARDS_PLACEHOLDER",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`));
  }
});
