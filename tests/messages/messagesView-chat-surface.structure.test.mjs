import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/MessagesView.vue"), "utf8");
const threadSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/ChannelThread.vue"), "utf8");
const composerSource = fs.readFileSync(path.join(repoRoot, "src/features/messages/ChannelComposer.vue"), "utf8");

test("MessagesView does not wrap content in GlassPanel", () => {
  assert.doesNotMatch(viewSource, /GlassPanel/);
});

test("ChannelThread and NotificationList render as direct children of messages-view grid", () => {
  assert.match(viewSource, /<ChannelThread/);
  assert.match(viewSource, /<NotificationList/);
  assert.doesNotMatch(viewSource, /messages-view__card/);
});

test("ChannelThread pane clears the fixed composer with bottom padding", () => {
  assert.match(threadSource, /padding-bottom:\s*calc\(/);
  assert.match(threadSource, /env\(safe-area-inset-bottom\)/);
});

test("ChannelThread load-older button sits above the message list", () => {
  const loadMoreIdx = threadSource.indexOf("messages-view__load-more");
  const listIdx = threadSource.indexOf("messages-view__list");
  assert.ok(loadMoreIdx >= 0, "load-more element should exist");
  assert.ok(listIdx >= 0, "list element should exist");
  assert.ok(loadMoreIdx < listIdx, "load-more should appear before the message list in the template");
});

test("ChannelThread preserves sender identity layout from #376: avatar left of bubble, author above bubble", () => {
  assert.match(threadSource, /messages-view__message-avatar/);
  assert.match(threadSource, /messages-view__message-author/);
  assert.match(threadSource, /messages-view__bubble/);
  assert.match(threadSource, /grid-template-columns:\s*32px\s+minmax/);
});

test("ChannelComposer compact state uses consistent button radius", () => {
  assert.match(composerSource, /is-compact/);
  assert.match(composerSource, /var\(--radius-button\)/);
});
