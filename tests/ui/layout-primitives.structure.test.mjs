import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readSource(name) {
  return fs.readFileSync(path.join(repoRoot, "src/ui/layout", name), "utf8");
}

// -- PageSurface --

test("PageSurface exposes as, bleed, and padded props", () => {
  const src = readSource("PageSurface.vue");
  assert.match(src, /as\?\s*:\s*string/);
  assert.match(src, /bleed\?\s*:\s*boolean/);
  assert.match(src, /padded\?\s*:\s*boolean/);
});

test("PageSurface applies BEM-lite classes", () => {
  const src = readSource("PageSurface.vue");
  assert.match(src, /class="page-surface"/);
  assert.match(src, /page-surface--bleed/);
  assert.match(src, /page-surface--padded/);
});

test("PageSurface defaults to <main> element", () => {
  const src = readSource("PageSurface.vue");
  assert.match(src, /as:\s*"main"/);
});

// -- EmptyState --

test("EmptyState exposes icon, title, and description props", () => {
  const src = readSource("EmptyState.vue");
  assert.match(src, /icon\?\s*:\s*string/);
  assert.match(src, /title\?\s*:\s*string/);
  assert.match(src, /description\?\s*:\s*string/);
});

test("EmptyState has action slot", () => {
  const src = readSource("EmptyState.vue");
  assert.match(src, /name="action"/);
});

test("EmptyState uses role=status for accessibility", () => {
  const src = readSource("EmptyState.vue");
  assert.match(src, /role="status"/);
});

test("EmptyState applies BEM-lite classes", () => {
  const src = readSource("EmptyState.vue");
  assert.match(src, /class="empty-state"/);
  assert.match(src, /empty-state__icon/);
  assert.match(src, /empty-state__title/);
  assert.match(src, /empty-state__description/);
  assert.match(src, /empty-state__action/);
});
