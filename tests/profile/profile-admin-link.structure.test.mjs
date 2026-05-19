import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

const SRC = "src/features/profile/ProfileAdminLink.vue";

// --- Component shape ---
//
// ProfileAdminLink replaces the dev-gated admin entry that previously lived
// inline in ProfileView. Pulling it out keeps both the markup and the
// VITE_ADMIN_VISIBLE env-var dependency out of ProfileView, leaving ProfileView
// free of identity / admin concerns entirely.

test("ProfileAdminLink imports ADMIN_ENTER_LABEL from config/brand", () => {
  const src = read(SRC);
  assert.match(src, /import\s*\{\s*ADMIN_ENTER_LABEL\s*\}\s*from\s*"\.\.\/\.\.\/config\/brand"/);
});

test("ProfileAdminLink emits enter-admin (no payload)", () => {
  const src = read(SRC);
  assert.match(src, /defineEmits<\{[\s\S]*?"enter-admin":\s*\[\]/);
});

test("ProfileAdminLink gates rendering on VITE_ADMIN_VISIBLE === 'true'", () => {
  const src = read(SRC);
  assert.match(src, /import\.meta\.env\.VITE_ADMIN_VISIBLE\s*===\s*"true"/);
  assert.match(src, /const\s+visible\s*=\s*computed\(/);
  assert.match(src, /<footer\s+v-if="visible"/);
});

test("ProfileAdminLink renders ADMIN_ENTER_LABEL inside its trigger button", () => {
  const src = read(SRC);
  assert.match(src, /<button[^>]*@click="emit\('enter-admin'\)"[\s\S]*?ADMIN_ENTER_LABEL/);
});

// --- Footer styling preserved ---

test("ProfileAdminLink footer keeps the dashed separator + muted typography from before extraction", () => {
  const src = read(SRC);
  assert.match(src, /\.profile-admin-link\b/);
  assert.match(src, /border-top:\s*1px dashed/);
  assert.match(src, /color:\s*var\(--lian-muted\)/);
  // Original used opacity 0.6 to fade the link by default; preserve it.
  assert.match(src, /opacity:\s*0\.6/);
});

// --- ProfileView wiring + cleanup ---

test("ProfileView mounts ProfileAdminLink and forwards enter-admin to setActiveView", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.match(src, /import ProfileAdminLink/);
  assert.match(src, /<ProfileAdminLink\s+@enter-admin="setActiveView\('admin'\)"/);
});

test("ProfileView no longer references the env-var or inline admin markup", () => {
  const src = read("src/features/profile/ProfileView.vue");
  assert.doesNotMatch(src, /VITE_ADMIN_VISIBLE/);
  assert.doesNotMatch(src, /ADMIN_ENTER_LABEL/);
  assert.doesNotMatch(src, /profile-view__admin-entry/);
  assert.doesNotMatch(src, /profile-view__admin-link/);
});
