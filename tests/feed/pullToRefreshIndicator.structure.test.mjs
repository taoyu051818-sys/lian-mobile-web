import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = fs
  .readFileSync(path.join(repoRoot, "src/features/feed/PullToRefreshIndicator.vue"), "utf8")
  .replace(/\r\n/g, "\n");

test("pull-to-refresh composes horizontal centering with vertical pull movement", () => {
  assert.match(source, /"--pull-refresh-y": `\$\{props\.pullDistance - 20\}px`/);
  assert.match(source, /transform: translate\(-50%, var\(--pull-refresh-y, -20px\)\);/);
  assert.doesNotMatch(source, /transform: `translateY/);
});

test("pull-to-refresh uses the shared tonal refresh-button visual language", () => {
  assert.match(source, /border-radius: var\(--radius-chip, 999px\);/);
  assert.match(source, /background: var\(--lian-primary-soft, #e4f7f5\);/);
  assert.match(source, /color: var\(--lian-primary-deep, #087b78\);/);
  assert.match(source, /font-weight: 800;/);
});
