import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- ProfileVerificationBadges component shape ---

test("ProfileVerificationBadges reads from verificationState first, falls back to flat tags", () => {
  const src = read("src/features/profile/ProfileVerificationBadges.vue");
  assert.match(src, /verificationState/);
  assert.match(src, /verificationTags/);
  // Falls back to user.tags so legacy /api/auth/me payloads still surface badges.
  assert.match(src, /user\.tags/);
  // Header surfaces only currently-active grants.
  assert.match(src, /record\.active/);
});

test("ProfileVerificationBadges reuses VERIFICATION_DESCRIPTORS from verification-format", () => {
  const src = read("src/features/profile/ProfileVerificationBadges.vue");
  assert.match(src, /VERIFICATION_DESCRIPTORS/);
  assert.match(src, /from\s+["']\.\.\/verification\/verification-format["']/);
});

test("ProfileVerificationBadges exposes test ids for the row and each badge", () => {
  const src = read("src/features/profile/ProfileVerificationBadges.vue");
  assert.match(src, /data-testid="profile-verification-badges"/);
  assert.match(src, /data-testid="profile-verification-badge"/);
  // data-tag attribute lets the CSS color-code per verification kind without
  // bloating the brand string list with per-tag wording.
  assert.match(src, /:data-tag="badge\.tag"/);
});

test("ProfileVerificationBadges hides itself when no badges are active", () => {
  const src = read("src/features/profile/ProfileVerificationBadges.vue");
  assert.match(src, /v-if="activeBadges\.length"/);
});

// --- ProfileHeader wires the badge row in ---

test("ProfileHeader mounts ProfileVerificationBadges above the alias chips", () => {
  const src = read("src/features/profile/ProfileHeader.vue");
  assert.match(src, /import ProfileVerificationBadges/);
  assert.match(src, /<ProfileVerificationBadges :user="user" \/>/);
  // Stays out of the existing PROFILE_IDENTITY_TAGS chips row — that one
  // surfaces free-text identity tags, not verification grants.
  const badgeIdx = src.indexOf("<ProfileVerificationBadges");
  const chipsIdx = src.indexOf("profile-header__chips");
  assert.ok(badgeIdx > -1 && chipsIdx > -1, "both rows should be present");
  assert.ok(
    badgeIdx < chipsIdx,
    "verification badges should sit above the free-text identity chips",
  );
});

// --- Brand string is registered ---

test("PROFILE_VERIFICATION_BADGES_LABEL is exported from config/brand", () => {
  const src = read("src/config/brand/profile.ts");
  assert.match(src, /export const PROFILE_VERIFICATION_BADGES_LABEL/);
});
