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
  assert.match(src, /scroll-padding-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/);
});

test("AuthPanel opts into the shared keyboard-aware surface contract", () => {
  const src = read("src/features/auth/AuthPanel.vue");
  assert.match(src, /auth-panel keyboard-aware-surface/);
  assert.match(src, /auth-panel__form keyboard-aware-surface/);
  assert.match(src, /padding-bottom: calc\(var\(--space-3\) \+ min\(var\(--keyboard-inset-bottom\), 240px\)\)/);
  assert.match(src, /scroll-padding-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/);
});

test("ProfileEditorPanel opts into the shared keyboard-aware surface contract", () => {
  const src = read("src/features/profile/ProfileEditorPanel.vue");
  assert.match(src, /profile-editor keyboard-aware-surface/);
  assert.match(src, /padding-bottom: calc\(var\(--space-3\) \+ min\(var\(--keyboard-inset-bottom\), 240px\)\)/);
  assert.match(src, /scroll-margin-bottom: calc\(var\(--space-6\) \+ var\(--keyboard-inset-bottom\)\)/);
});

test("Sheet keeps focused controls visible inside the panel", () => {
  const src = read("src/ui/Sheet.vue");
  assert.match(src, /function keepFocusVisible/);
  assert.match(src, /scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);
  assert.match(src, /@focusin="handleFocusIn"/);
  assert.match(src, /lian-sheet__panel keyboard-aware-surface/);
});

test("Shared primitives define keyboard-aware scroll spacing and sheet bottom inset", () => {
  const src = read("src/ui/primitives.css");
  assert.match(src, /\.keyboard-aware-surface \{/);
  assert.match(src, /scroll-padding-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/);
  assert.match(src, /scroll-margin-bottom: calc\(var\(--space-8\) \+ var\(--keyboard-inset-bottom\)\)/);
  assert.match(src, /\.lian-sheet__panel \{[\s\S]*padding-bottom: calc\(var\(--space-4\) \+ env\(safe-area-inset-bottom\) \+ var\(--keyboard-inset-bottom\)\)/);
  assert.match(src, /\.lian-sheet__panel \{[\s\S]*overflow-y: auto/);
  assert.match(src, /\.lian-sheet__panel \{[\s\S]*max-height: min\(88vh, calc\(100dvh - env\(safe-area-inset-top\) - var\(--space-4\)\)\)/);
});

test("QA checklist includes secondary mobile keyboard verification rows", () => {
  const src = read("docs/qa/shell-visual-regression-checklist.md");
  assert.match(src, /## 8\. Mobile Keyboard Surfaces/);
  assert.match(src, /MK-1 \| Publish view title\/body\/location fields on mobile/);
  assert.match(src, /MK-2 \| Auth panel login\/register fields on mobile/);
  assert.match(src, /MK-3 \| Profile editor avatar\/invite controls on mobile/);
  assert.match(src, /MK-4 \| Any Sheet-hosted input on mobile/);
});
