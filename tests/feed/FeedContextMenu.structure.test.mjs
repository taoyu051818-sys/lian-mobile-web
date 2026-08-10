import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = fs
  .readFileSync(path.join(repoRoot, "src/features/feed/FeedContextMenu.vue"), "utf8")
  .replace(/\r\n/g, "\n");
const brandSource = fs
  .readFileSync(path.join(repoRoot, "src/config/brand/feed.ts"), "utf8")
  .replace(/\r\n/g, "\n");
const templateMatch = source.match(/<template>([\s\S]*?)<\/template>/);
assert.ok(templateMatch, "FeedContextMenu must have one template block");
const templateSource = templateMatch[1];

function buttonBlockFor(handler) {
  const matches = [...templateSource.matchAll(/<button\b[\s\S]*?<\/button>/g)]
    .map((match) => match[0])
    .filter((block) => new RegExp(`@click=["']${handler}["']`).test(block));
  assert.equal(matches.length, 1, `expected exactly one button owned by ${handler}`);
  return matches[0];
}

function menuOpeningTag() {
  const matches = [...templateSource.matchAll(/<div\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /role=["']menu["']/.test(tag));
  assert.equal(matches.length, 1, "expected exactly one role=menu container");
  return matches[0];
}

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

test("FeedContextMenu exposes truthful bookmark and report labels", () => {
  const shareButton = buttonBlockFor("handleShareAction");
  const bookmarkButton = buttonBlockFor("handleBookmarkAction");
  const reportButton = buttonBlockFor("handleReportAction");

  assert.match(brandSource, /export const GESTURE_CONTEXT_BOOKMARK = "收藏";/);
  assert.match(brandSource, /export const GESTURE_CONTEXT_UNBOOKMARK = "取消收藏";/);
  assert.match(brandSource, /export const GESTURE_CONTEXT_REPORT = "前往详情举报";/);
  assert.match(shareButton, /\{\{\s*GESTURE_CONTEXT_SHARE\s*\}\}/);
  assert.match(
    bookmarkButton,
    /bookmarked\s*\?\s*GESTURE_CONTEXT_UNBOOKMARK\s*:\s*GESTURE_CONTEXT_BOOKMARK/,
  );
  assert.match(reportButton, /\{\{\s*GESTURE_CONTEXT_REPORT\s*\}\}/);
});

test("FeedContextMenu presents independent action busy state and bookmark semantics", () => {
  const propsBlock = source.match(/defineProps<\{([\s\S]*?)\}>\(\)/);
  assert.ok(propsBlock, "FeedContextMenu must declare typed props");
  assert.match(propsBlock[1], /bookmarkBusy\??:\s*boolean/);
  assert.match(propsBlock[1], /shareBusy\??:\s*boolean/);
  assert.match(propsBlock[1], /requestPending\??:\s*boolean/);

  const menuTag = menuOpeningTag();
  const shareButton = buttonBlockFor("handleShareAction");
  const bookmarkButton = buttonBlockFor("handleBookmarkAction");
  buttonBlockFor("handleReportAction");

  assert.match(menuTag, /:aria-busy="requestPending"/);
  assert.match(shareButton, /:disabled="shareBusy"/);
  assert.match(bookmarkButton, /:disabled="bookmarkBusy"/);
  assert.match(bookmarkButton, /:aria-pressed="bookmarked"/);
});
