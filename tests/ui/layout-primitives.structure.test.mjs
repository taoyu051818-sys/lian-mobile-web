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

// -- PageSection --

test("PageSection exposes as, title, and description props", () => {
  const src = readSource("PageSection.vue");
  assert.match(src, /as\?\s*:\s*string/);
  assert.match(src, /title\?\s*:\s*string/);
  assert.match(src, /description\?\s*:\s*string/);
});

test("PageSection has header and default slots", () => {
  const src = readSource("PageSection.vue");
  assert.match(src, /name="header"/);
  assert.match(src, /<slot\s*\/>/);
});

test("PageSection applies BEM-lite classes", () => {
  const src = readSource("PageSection.vue");
  assert.match(src, /class="page-section"/);
  assert.match(src, /page-section__header/);
  assert.match(src, /page-section__title/);
  assert.match(src, /page-section__description/);
});

// -- ContentStack --

test("ContentStack exposes as, gap, and align props", () => {
  const src = readSource("ContentStack.vue");
  assert.match(src, /as\?\s*:\s*string/);
  assert.match(src, /gap\?\s*:\s*"sm"\s*\|\s*"md"\s*\|\s*"lg"/);
  assert.match(src, /align\?\s*:\s*"start"\s*\|\s*"center"\s*\|\s*"end"\s*\|\s*"stretch"/);
});

test("ContentStack applies gap and align modifier classes", () => {
  const src = readSource("ContentStack.vue");
  assert.match(src, /content-stack--gap-\$\{gap\}/);
  assert.match(src, /content-stack--align-\$\{align\}/);
});

// -- ActionRow --

test("ActionRow exposes as, justify, and wrap props", () => {
  const src = readSource("ActionRow.vue");
  assert.match(src, /as\?\s*:\s*string/);
  assert.match(src, /justify\?\s*:\s*"start"\s*\|\s*"center"\s*\|\s*"end"\s*\|\s*"between"\s*\|\s*"around"/);
  assert.match(src, /wrap\?\s*:\s*boolean/);
});

test("ActionRow applies justify modifier and wrap class", () => {
  const src = readSource("ActionRow.vue");
  assert.match(src, /action-row--justify-\$\{justify\}/);
  assert.match(src, /action-row--wrap/);
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
