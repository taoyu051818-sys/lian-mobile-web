import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- PublishView template: View post link contract ---
//
// After a successful publish the success block exposes a "查看帖子" link.
// These tests assert that the link is conditionally rendered (only when
// postDetailUrl is truthy) and that its href is bound to postDetailUrl,
// which produces `#/post/{tid}`.

test("PublishView template has view-post link with data-testid", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /data-testid="publish-view-post-link"/);
});

test("PublishView template guards view-post link with v-if on postDetailUrl", () => {
  const src = read("src/views/PublishView.vue");
  // The <a> element must be conditionally rendered only when postDetailUrl is truthy
  assert.match(
    src,
    /v-if="postDetailUrl"[\s\S]*?data-testid="publish-view-post-link"/,
  );
});

test("PublishView template binds href to postDetailUrl on view-post link", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(
    src,
    /:href="postDetailUrl"[\s\S]*?data-testid="publish-view-post-link"/,
  );
});

test("PublishView template renders view-post link inside success block", () => {
  const src = read("src/views/PublishView.vue");
  // The link lives inside the success-block div, which is itself guarded by successMessage
  assert.match(
    src,
    /v-if="successMessage"[\s\S]*?class="publish-view__success-block"[\s\S]*?data-testid="publish-view-post-link"/,
  );
});

test("PublishView template shows 查看帖子 as link text", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /data-testid="publish-view-post-link"[\s\S]*?>查看帖子<\/a>/);
});

// --- PublishView script: postDetailUrl computed property ---

test("PublishView defines postDetailUrl computed property", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /const postDetailUrl = computed\(/);
});

test("PublishView postDetailUrl returns empty string when lastTid is falsy", () => {
  const src = read("src/views/PublishView.vue");
  // The computed must guard against falsy tid before building the URL
  assert.match(src, /if \(!tid\) return ""/);
});

test("PublishView postDetailUrl builds hash-route URL with tid", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /`#\/post\/\$\{tid\}`/);
});

test("PublishView postDetailUrl reads from lastTid ref", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /const tid = lastTid\.value/);
});

// --- PublishView script: lastTid lifecycle ---

test("PublishView declares lastTid as a ref with null initial value", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /const lastTid = ref<[^>]*>\(null\)/);
});

test("PublishView resets lastTid to null before submit validation", () => {
  const src = read("src/views/PublishView.vue");
  // submitPublish must clear lastTid at the top so stale links don't persist
  assert.match(src, /lastTid\.value = null/);
});

test("PublishView sets lastTid from publish response tid", () => {
  const src = read("src/views/PublishView.vue");
  assert.match(src, /lastTid\.value = response\.tid/);
});
