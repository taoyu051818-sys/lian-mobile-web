import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const profileViewSource = fs.readFileSync(
  path.join(repoRoot, "src/features/profile/ProfileView.vue"),
  "utf8",
);
const unlockSource = fs.readFileSync(
  path.join(repoRoot, "src/features/profile/profileUnlocks.ts"),
  "utf8",
);
const brandSource = fs.readFileSync(path.join(repoRoot, "src/config/brand/profile.ts"), "utf8");

test("profile unlock helper maps campus, merchant, and runner tags to verification-center cards", () => {
  for (const tag of ["campus_verified", "merchant_verified", "runner"]) {
    assert.match(unlockSource, new RegExp(`hasActiveVerificationTag\\(user, "${tag}"\\)`));
  }

  for (const testId of [
    '"profile-unlock-campus"',
    '"profile-unlock-merchant"',
    '"profile-unlock-runner"',
  ]) {
    assert.match(unlockSource, new RegExp(`testId:\\s*${testId}`));
  }
});

test("ProfileView renders unlock cards and only mounts errand orders after campus verification", () => {
  assert.match(profileViewSource, /buildProfileUnlockCards/);
  assert.match(profileViewSource, /const isCampusVerified = computed/);
  assert.match(profileViewSource, /v-if="unlockCards\.length"/);
  assert.match(profileViewSource, /data-testid="profile-unlock-card-cta"/);
  assert.match(profileViewSource, /<ProfileErrandOrdersBlock v-if="isCampusVerified" \/>/);
});

test("ProfileView routes every unlock CTA back into the verification center", () => {
  assert.match(profileViewSource, /@click="setActiveView\(card\.targetView\)"/);
  assert.match(unlockSource, /targetView: "verification"/);
});

test("profile unlock brand strings exist and keep the humane unlock copy", () => {
  for (const key of [
    "PROFILE_UNLOCKS_SECTION_LABEL",
    "PROFILE_UNLOCK_GO_VERIFY",
    "PROFILE_UNLOCK_CAMPUS_TITLE",
    "PROFILE_UNLOCK_CAMPUS_HINT",
    "PROFILE_UNLOCK_MERCHANT_TITLE",
    "PROFILE_UNLOCK_MERCHANT_HINT",
    "PROFILE_UNLOCK_RUNNER_TITLE",
    "PROFILE_UNLOCK_RUNNER_HINT",
  ]) {
    assert.match(brandSource, new RegExp(`export const ${key}\\s*=\\s*"[^"\\s][^"]*"`));
  }

  assert.match(brandSource, /开通跑腿员后可查看接单与配送记录/);
  assert.match(brandSource, /解锁二手与更多校园内容/);
});
