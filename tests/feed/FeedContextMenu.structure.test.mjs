import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = fs
  .readFileSync(path.join(repoRoot, "src/features/feed/FeedContextMenu.vue"), "utf8")
  .replace(/\r\n/g, "\n");

test("FeedContextMenu keeps delayed close behavior explicit", () => {
  assert.match(source, /let hideTimer: ReturnType<typeof setTimeout> \| null = null;/);
  assert.match(
    source,
    /if \(reduced\.value\) \{\n\s*clearHideTimer\(\);\n\s*isVisible\.value = false;/,
  );
  assert.match(
    source,
    /hideTimer = setTimeout\(\(\) => \{\n\s*hideTimer = null;\n\s*isVisible\.value = false;\n\s*\}, 160\);/,
  );
});

test("FeedContextMenu clears delayed close timers before replacement and unmount", () => {
  assert.match(
    source,
    /function clearHideTimer\(\) \{\n\s*if \(hideTimer !== null\) \{\n\s*clearTimeout\(hideTimer\);\n\s*hideTimer = null;\n\s*\}\n\s*\}/,
  );
  assert.match(source, /if \(visible\) \{\n\s*clearHideTimer\(\);\n\s*isVisible\.value = true;/);
  assert.match(source, /\} else \{\n\s*clearHideTimer\(\);\n\s*hideTimer = setTimeout\(\(\) => \{/);
  assert.match(source, /onBeforeUnmount\(\(\) => \{\n\s*clearHideTimer\(\);/);
});
