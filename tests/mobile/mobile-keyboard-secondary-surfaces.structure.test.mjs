import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("PublishView opts into the shared keyboard-aware surface contract", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /publish-view keyboard-aware-surface/);
  assert.match(src, /publish-view__form keyboard-aware-surface/);
  assert.match(src, /padding-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/);
  assert.match(
    src,
    /scroll-padding-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/,
  );
});

test("AuthPanel opts into the shared keyboard-aware surface contract", () => {
  const src = read("src/features/auth/AuthPanel.vue");
  assert.match(src, /auth-panel keyboard-aware-surface/);
  assert.match(src, /auth-panel__form keyboard-aware-surface/);
  assert.match(
    src,
    /padding-bottom: calc\(var\(--space-3\) \+ min\(var\(--keyboard-inset-bottom\), 240px\)\)/,
  );
  assert.match(
    src,
    /scroll-padding-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/,
  );
});

test("ProfileEditorPanel opts into the shared keyboard-aware surface contract", () => {
  const src = read("src/features/profile/ProfileEditorPanel.vue");
  assert.match(src, /profile-editor keyboard-aware-surface/);
  assert.match(
    src,
    /padding-bottom: calc\(var\(--space-3\) \+ min\(var\(--keyboard-inset-bottom\), 240px\)\)/,
  );
  assert.match(
    src,
    /scroll-margin-bottom: calc\(var\(--space-6\) \+ var\(--keyboard-inset-bottom\)\)/,
  );
});

test("Shared primitives define keyboard-aware scroll spacing", () => {
  const src = read("src/ui/primitives.css");
  assert.match(src, /\.keyboard-aware-surface \{/);
  assert.match(
    src,
    /scroll-padding-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/,
  );
  assert.match(
    src,
    /scroll-margin-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/,
  );
});
