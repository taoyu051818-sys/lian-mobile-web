import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const lianButtonSource = fs.readFileSync(path.join(repoRoot, "src/ui/LianButton.vue"), "utf8");

test("LianButton stays free of Feed auto-load ownership", () => {
  assert.doesNotMatch(lianButtonSource, /IntersectionObserver/);
  assert.doesNotMatch(lianButtonSource, /feed-view__load-more/);
  assert.doesNotMatch(lianButtonSource, /loadMoreSentinelRef/);
  assert.doesNotMatch(lianButtonSource, /useAutoLoadSentinel/);
});

test("LianButton still gates click events through disabled and loading state", () => {
  assert.match(lianButtonSource, /function isDisabled\(\)/);
  assert.match(lianButtonSource, /return props\.disabled \|\| props\.loading;/);
  assert.match(lianButtonSource, /if \(isDisabled\(\)\) return;/);
  assert.match(lianButtonSource, /emit\("click", event\);/);
  assert.match(lianButtonSource, /:disabled="disabled \|\| loading"/);
});