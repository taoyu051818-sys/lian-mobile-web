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

test("profile API wires wallet balances and rewards ledger endpoints", () => {
  const src = read("src/api/profile.ts");
  assert.match(src, /export async function fetchProfileWallet/);
  assert.match(src, /apiGet<ProfileWallet>\("\/api\/wallet\/me"\)/);
  assert.match(src, /export async function fetchProfileRewards/);
  assert.match(src, /apiGet<ProfileRewards>\("\/api\/me\/rewards"\)/);
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

test("ProfileStatsBlock surfaces wallet balances plus rewards ledger fallback", () => {
  const statsSrc = read("src/features/profile/ProfileStatsBlock.vue");
  const src = read("src/features/profile/ProfileRewardsBlock.vue");
  assert.match(statsSrc, /import ProfileRewardsBlock/);
  assert.match(statsSrc, /<ProfileRewardsBlock \/>/);
  assert.match(src, /fetchProfileWallet/);
  assert.match(src, /fetchProfileRewards/);
  assert.match(src, /data-testid="profile-wallet-summary"/);
  assert.match(src, /data-testid="profile-rewards-ledger"/);
  assert.match(src, /data-testid="profile-rewards-empty"/);
  assert.match(src, /data-testid="profile-rewards-placeholder"/);
  assert.match(src, /rewards\.value\?\.lifecycle === "active"/);
  assert.match(src, /PROFILE_REWARDS_POINTS_LABEL/);
  assert.match(src, /PROFILE_REWARDS_HONORS_LABEL/);
  assert.match(src, /PROFILE_REWARDS_LOCKED_POINTS_LABEL/);
});

// --- ProfileView mounts the block above the tabs ---

test("ProfileView mounts ProfileStatsBlock between editor panel and tabs", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import ProfileStatsBlock/);
  assert.match(src, /<ProfileStatsBlock \/>/);
  const blockIdx = src.indexOf("<ProfileStatsBlock");
  const tabsIdx = src.indexOf("<ProfileTabs");
  const editorIdx = src.indexOf("<ProfileEditorPanel");
  assert.ok(editorIdx > -1 && blockIdx > -1 && tabsIdx > -1, "all three should be present");
  assert.ok(editorIdx < blockIdx, "stats block sits below editor panel");
  assert.ok(blockIdx < tabsIdx, "stats block sits above tabs");
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
    "PROFILE_REWARDS_LOCKED_POINTS_LABEL",
    "PROFILE_REWARDS_PLACEHOLDER",
    "PROFILE_REWARDS_EMPTY",
    "PROFILE_REWARDS_LOAD_ERROR",
  ]) {
    assert.match(src, new RegExp(`export const ${key}\\b`));
  }
});
