import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("PublishView opts into visualViewport keyboard spacing", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /useVisualViewport/);
  assert.match(src, /--keyboard-inset-bottom/);
  assert.match(src, /scroll-margin-bottom/);
});

test("AuthPanel adds keyboard-safe padding and scroll margin", () => {
  const src = read("src/views/auth/AuthPanel.vue");
  assert.match(src, /useVisualViewport/);
  assert.match(src, /padding-bottom: calc\(var\(--space-3\) \+ env\(safe-area-inset-bottom\) \+ var\(--keyboard-inset-bottom, 0px\)\)/);
  assert.match(src, /scroll-margin-bottom/);
});

test("ProfileEditorPanel adds keyboard-safe spacing for editor controls", () => {
  const src = read("src/views/profile/ProfileEditorPanel.vue");
  assert.match(src, /useVisualViewport/);
  assert.match(src, /scroll-padding-bottom/);
  assert.match(src, /scroll-margin-bottom/);
});

test("Sheet panel rises above keyboard and keeps content scrollable", () => {
  const src = read("src/ui/Sheet.vue");
  assert.match(src, /useVisualViewport/);
  assert.match(src, /bottom: var\(--keyboard-inset-bottom, 0px\)/);
  assert.match(src, /max-height: calc\(100dvh - env\(safe-area-inset-top\) - var\(--space-4\) - var\(--keyboard-inset-bottom, 0px\)\)/);
  assert.match(src, /overflow-y: auto/);
  assert.match(src, /scroll-padding-bottom/);
});
