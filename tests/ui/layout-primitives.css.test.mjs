import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cssSource = fs.readFileSync(path.join(repoRoot, "src/ui/primitives.css"), "utf8");

test("primitives.css defines page-surface styles", () => {
  assert.match(cssSource, /\.page-surface\s*\{/);
  assert.match(cssSource, /\.page-surface--padded/);
  assert.match(cssSource, /\.page-surface--bleed/);
});

test("primitives.css defines page-section styles", () => {
  assert.match(cssSource, /\.page-section\s*\{/);
  assert.match(cssSource, /\.page-section__header/);
  assert.match(cssSource, /\.page-section__title/);
  assert.match(cssSource, /\.page-section__description/);
});

test("primitives.css defines content-stack styles", () => {
  assert.match(cssSource, /\.content-stack\s*\{/);
  assert.match(cssSource, /\.content-stack--gap-sm/);
  assert.match(cssSource, /\.content-stack--gap-md/);
  assert.match(cssSource, /\.content-stack--gap-lg/);
});

test("primitives.css defines action-row styles", () => {
  assert.match(cssSource, /\.action-row\s*\{/);
  assert.match(cssSource, /\.action-row--justify-start/);
  assert.match(cssSource, /\.action-row--justify-end/);
  assert.match(cssSource, /\.action-row--justify-between/);
  assert.match(cssSource, /\.action-row--wrap/);
});

test("primitives.css defines empty-state styles", () => {
  assert.match(cssSource, /\.empty-state\s*\{/);
  assert.match(cssSource, /\.empty-state__icon/);
  assert.match(cssSource, /\.empty-state__title/);
  assert.match(cssSource, /\.empty-state__description/);
  assert.match(cssSource, /\.empty-state__action/);
});

test("layout primitives use CSS custom properties for spacing", () => {
  assert.match(cssSource, /var\(--space-/);
});

test("layout primitives use safe-area-inset for bottom padding", () => {
  assert.match(cssSource, /env\(safe-area-inset-bottom\)/);
});
