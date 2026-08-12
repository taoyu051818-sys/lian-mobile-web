import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n?/g, "\n");
}

const cssSource = read("src/ui/primitives.css");
const pageSurfaceSource = read("src/ui/layout/PageSurface.vue");
const emptyStateSource = read("src/ui/layout/EmptyState.vue");

test("PageSurface component and stylesheet share the current layout class contract", () => {
  for (const className of ["page-surface", "page-surface--padded", "page-surface--bleed"]) {
    assert.match(pageSurfaceSource, new RegExp(className));
    assert.match(cssSource, new RegExp(`\\.${className}\\b`));
  }
});

test("EmptyState component and stylesheet share the current layout class contract", () => {
  for (const className of [
    "empty-state",
    "empty-state__icon",
    "empty-state__copy",
    "empty-state__title",
    "empty-state__description",
    "empty-state__action",
  ]) {
    assert.match(emptyStateSource, new RegExp(className));
    assert.match(cssSource, new RegExp(`\\.${className}\\b`));
  }
});

test("keyboard-aware surface clears focused controls with the keyboard inset token", () => {
  assert.match(cssSource, /\.keyboard-aware-surface\s*\{[\s\S]*?--keyboard-inset-bottom/);
  assert.match(
    cssSource,
    /\.keyboard-aware-surface\s+:is\(input,\s*textarea,\s*select,\s*\[contenteditable="true"\]\)[\s\S]*?scroll-margin-bottom/,
  );
});

test("bottom tab bar is fixed and respects right, bottom, and left safe areas", () => {
  assert.match(cssSource, /\.bottom-tab-bar\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(cssSource, /right:\s*max\([^;]*env\(safe-area-inset-right\)/);
  assert.match(cssSource, /bottom:\s*calc\([^;]*env\(safe-area-inset-bottom\)/);
  assert.match(cssSource, /left:\s*max\([^;]*env\(safe-area-inset-left\)/);
});

test("toast host is a fixed safe-area-aware feedback layout", () => {
  assert.match(cssSource, /\.toast-host\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(cssSource, /\.toast-host\s*\{[\s\S]*?env\(safe-area-inset-top\)/);
  assert.match(cssSource, /\.toast-host__item\s*\{[\s\S]*?pointer-events:\s*auto/);
});

test("inline error keeps message and action layout styles", () => {
  assert.match(cssSource, /\.inline-error\s*\{[\s\S]*?display:\s*flex/);
  assert.match(cssSource, /\.inline-error__message\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(cssSource, /\.inline-error__action\.lian-button\s*\{/);
});

test("layout primitives use spacing tokens and safe-area bottom padding", () => {
  assert.match(cssSource, /var\(--space-/);
  assert.match(cssSource, /\.page-surface--padded\s*\{[\s\S]*?env\(safe-area-inset-bottom\)/);
});
