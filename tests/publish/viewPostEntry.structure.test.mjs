import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
}

function viewPostLink(source) {
  const marker = source.indexOf('data-testid="publish-view-post-link"');
  const start = source.lastIndexOf("<a", marker);
  const end = source.indexOf("</a>", marker);
  assert.ok(start > -1 && marker > start && end > marker, "view-post link should exist");
  return source.slice(start, end + 4);
}

// --- PublishView template: View post link contract ---
//
// After a successful publish the success block exposes a "查看帖子" link.
// These tests assert that the link is conditionally rendered (only when
// postDetailUrl is truthy) and that its href is bound to postDetailUrl,
// which produces `#/post/{tid}`.

test("PublishView template has view-post link with data-testid", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(viewPostLink(src), /data-testid="publish-view-post-link"/);
});

test("PublishView template guards view-post link with v-if on postDetailUrl", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(viewPostLink(src), /v-if="postDetailUrl"/);
});

test("PublishView template binds href to postDetailUrl on view-post link", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(viewPostLink(src), /:href="postDetailUrl"/);
});

test("PublishView template renders view-post link inside success block", () => {
  const src = read("src/features/publish/PublishView.vue");
  const marker = src.indexOf('data-testid="publish-view-post-link"');
  const start = src.lastIndexOf("<PublishMessage", marker);
  const end = src.indexOf("</PublishMessage>", marker);
  assert.ok(start > -1 && end > marker, "view-post link should live in a PublishMessage");
  const successBlock = src.slice(start, end);
  assert.match(successBlock, /v-if="draft\.successMessage\.value"/);
  assert.match(successBlock, /variant="success"/);
});

test("PublishView template renders the shared view-post label", () => {
  const src = read("src/features/publish/PublishView.vue");
  const brandSrc = read("src/config/brand/publish.ts");
  assert.match(src, /\bPUBLISH_VIEW_POST\b/);
  assert.match(viewPostLink(src), /\{\{\s*PUBLISH_VIEW_POST\s*\}\}/);
  assert.match(brandSrc, /export const PUBLISH_VIEW_POST\s*=\s*"查看帖子"/);
});

// --- usePublishSubmit: postDetailUrl computed property ---

test("usePublishSubmit defines postDetailUrl computed property", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  assert.match(src, /const postDetailUrl = computed\(/);
});

test("usePublishSubmit postDetailUrl returns empty string when lastTid is falsy", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  // The computed must guard against falsy tid before building the URL
  assert.match(src, /if \(!tid\) return ""/);
});

test("usePublishSubmit postDetailUrl builds hash-route URL with tid", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  assert.match(src, /`#\/post\/\$\{tid\}`/);
});

test("PublishView wires its draft lastTid into usePublishSubmit", () => {
  const viewSrc = read("src/features/publish/PublishView.vue");
  const submitSrc = read("src/features/publish/usePublishSubmit.ts");
  assert.match(viewSrc, /lastTid:\s*draft\.lastTid/);
  assert.match(viewSrc, /const \{[^}]*postDetailUrl[^}]*\} = usePublishSubmit\(/);
  assert.match(submitSrc, /const tid = options\.lastTid\.value/);
});

// --- Draft and submit composables: lastTid lifecycle ---

test("usePublishDraft declares lastTid as a ref with null initial value", () => {
  const src = read("src/features/publish/usePublishDraft.ts");
  assert.match(src, /const lastTid = ref<string \| number \| null>\(null\)/);
  assert.match(src, /\blastTid,\s*$/m);
});

test("usePublishSubmit clears stale lastTid before validation can return", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  assert.match(src, /function clearPublishResult\(\)[\s\S]*?options\.lastTid\.value = null/);
  const submit = src.slice(src.indexOf("async function submitPublish()"));
  const clearIdx = submit.indexOf("clearPublishResult();");
  const earlyReturnIdx = submit.indexOf("if (validation || options.publishing.value) return;");
  assert.ok(clearIdx > -1 && clearIdx < earlyReturnIdx, "stale links clear before early return");
});

test("usePublishSubmit sets lastTid from event and post responses", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  const assignments = src.match(/options\.lastTid\.value = response\.tid \|\| null/g) ?? [];
  assert.equal(assignments.length, 2, "event and regular publish paths should both store the tid");
});
