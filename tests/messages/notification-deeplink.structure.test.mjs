import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const viewSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/MessagesView.vue"),
  "utf8",
);
const channelSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/useChannelMessages.ts"),
  "utf8",
);
const listSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/NotificationList.vue"),
  "utf8",
);

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

test("MessagesView wires notification detail through useDetailNavigation", () => {
  assert.match(viewSource, /useDetailNavigation/);
});

test("MessagesView no longer mounts PostDetailPanel locally (App-level DetailSurface owns it)", () => {
  assert.doesNotMatch(viewSource, /PostDetailPanel/);
  assert.doesNotMatch(viewSource, /messages-view__detail-overlay/);
});

test("MessagesView opens notifications via store.open(...)", () => {
  assert.match(viewSource, /detail\.open\(/);
});

test("MessagesView passes @open-item handler to NotificationList", () => {
  assert.match(viewSource, /@open-item="openNotification"/);
});

test("useChannelMessages preserves optimistic send behavior", () => {
  assert.match(channelSource, /buildPendingChannelMessage/);
  assert.match(channelSource, /replacePendingWithLatest/);
});

test("MessagesView preserves keyboard inset and visual viewport behavior", () => {
  assert.match(viewSource, /keyboard-inset-bottom/);
  assert.match(viewSource, /useVisualViewport/);
});

test("MessagesView uses declarative PageChromeSpec for shell control", () => {
  assert.match(viewSource, /chrome:\s*\[spec:\s*PageChromeSpec\]/);
  assert.match(viewSource, /pageChrome/);
});
