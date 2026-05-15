import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/views/MessagesView.vue"), "utf8");
const listSource = fs.readFileSync(path.join(repoRoot, "src/views/messages/NotificationList.vue"), "utf8");

test("NotificationList emits open-item with tid when notification is clicked", () => {
  assert.match(listSource, /"open-item":\s*\[tid:\s*number\]/);
  assert.match(listSource, /emit\("open-item",\s*tid\)/);
});

test("NotificationList guards open-item emit to valid positive tid only", () => {
  assert.match(listSource, /Number\.isFinite\(tid\)\s*&&\s*tid\s*>\s*0/);
});

test("NotificationList adds click and keyboard handlers on notification articles", () => {
  assert.match(listSource, /@click="openNotification\(item\)"/);
  assert.match(listSource, /@keydown\.enter="openNotification\(item\)"/);
});

test("NotificationList marks clickable notifications with role=button and tabindex", () => {
  assert.match(listSource, /role="button"/);
  assert.match(listSource, /tabindex/);
});

test("NotificationList applies is-clickable class only when tid is valid", () => {
  assert.match(listSource, /'is-clickable':\s*Number\(item\.tid\)\s*>\s*0/);
});

test("NotificationList has cursor pointer style for clickable notifications", () => {
  assert.match(listSource, /\.messages-view__notification\.is-clickable/);
  assert.match(listSource, /cursor:\s*pointer/);
});

test("MessagesView imports fetchPostDetail from api/posts", () => {
  assert.match(viewSource, /import.*fetchPostDetail.*from\s*"\.\.\/api\/posts"/);
});

test("MessagesView imports PostDetailPanel component", () => {
  assert.match(viewSource, /import\s+PostDetailPanel\s+from\s*"\.\/detail\/PostDetailPanel\.vue"/);
});

test("MessagesView imports FeedItemId and PostDetail types", () => {
  assert.match(viewSource, /FeedItemId/);
  assert.match(viewSource, /PostDetail/);
});

test("MessagesView declares detail state refs for notification deep-link", () => {
  assert.match(viewSource, /selectedPostId\s*=\s*ref/);
  assert.match(viewSource, /selectedPost\s*=\s*ref/);
  assert.match(viewSource, /detailLoading\s*=\s*ref/);
  assert.match(viewSource, /detailError\s*=\s*ref/);
  assert.match(viewSource, /savedScrollY\s*=\s*ref/);
});

test("MessagesView has detailOpen computed from selectedPostId", () => {
  assert.match(viewSource, /detailOpen\s*=\s*computed\(\(\)\s*=>\s*selectedPostId\.value\s*!==\s*null\)/);
});

test("MessagesView openNotification calls fetchPostDetail and handles errors", () => {
  assert.match(viewSource, /async\s+function\s+openNotification/);
  assert.match(viewSource, /fetchPostDetail\(tid\)/);
  assert.match(viewSource, /detailError\.value\s*=\s*error\s+instanceof\s+Error/);
});

test("MessagesView closeDetail resets detail state and restores scroll", () => {
  assert.match(viewSource, /function\s+closeDetail/);
  assert.match(viewSource, /selectedPostId\.value\s*=\s*null/);
  assert.match(viewSource, /selectedPost\.value\s*=\s*null/);
  assert.match(viewSource, /requestAnimationFrame\(\(\)\s*=>\s*window\.scrollTo\(0,\s*savedScrollY\.value\)\)/);
});

test("MessagesView retryDetail re-calls openNotification with selectedPostId", () => {
  assert.match(viewSource, /function\s+retryDetail/);
  assert.match(viewSource, /openNotification\(selectedPostId\.value\)/);
});

test("MessagesView passes @open-item handler to NotificationList", () => {
  assert.match(viewSource, /@open-item="openNotification"/);
});

test("MessagesView renders PostDetailPanel in a fixed overlay when detail is open", () => {
  assert.match(viewSource, /v-if="detailOpen"/);
  assert.match(viewSource, /class="messages-view__detail-overlay"/);
  assert.match(viewSource, /role="dialog"/);
  assert.match(viewSource, /aria-modal="true"/);
  assert.match(viewSource, /<PostDetailPanel/);
  assert.match(viewSource, /:post="selectedPost"/);
  assert.match(viewSource, /:loading="detailLoading"/);
  assert.match(viewSource, /:error="detailError"/);
  assert.match(viewSource, /@close="closeDetail"/);
  assert.match(viewSource, /@retry="retryDetail"/);
});

test("MessagesView detail overlay uses fixed positioning with full viewport coverage", () => {
  assert.match(viewSource, /\.messages-view__detail-overlay/);
  assert.match(viewSource, /position:\s*fixed/);
  assert.match(viewSource, /inset:\s*0/);
  assert.match(viewSource, /z-index:\s*30/);
});

test("MessagesView preserves existing optimistic send and keyboard inset behavior", () => {
  assert.match(viewSource, /buildPendingChannelMessage/);
  assert.match(viewSource, /replacePendingWithLatest/);
  assert.match(viewSource, /keyboard-inset-bottom/);
  assert.match(viewSource, /useVisualViewport/);
});

test("MessagesView preserves existing chrome emit for shell control", () => {
  assert.match(viewSource, /chrome:\s*\[hidden:\s*boolean\]/);
  assert.match(viewSource, /composerChrome\.dispose\(\)/);
});
