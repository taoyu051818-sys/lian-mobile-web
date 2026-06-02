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

test("NotificationList emits open-item with the full notification item when a clickable notification is activated", () => {
  assert.match(listSource, /"open-item":\s*\[item:\s*NotificationItem\]/);
  assert.match(listSource, /emit\("open-item",\s*item\)/);
});

test("NotificationList gates open-item emit through isClickable target-kind checks", () => {
  assert.match(listSource, /if \(isClickable\(item\)\) emit\("open-item", item\)/);
  assert.match(listSource, /item\.target\?\.kind === "detail"/);
  assert.match(listSource, /item\.target\?\.kind === "verification"/);
  assert.match(listSource, /item\.target\?\.kind === "errand-order"/);
});

test("NotificationList adds click and keyboard handlers on notification articles", () => {
  assert.match(listSource, /@click="openNotification\(item\)"/);
  assert.match(listSource, /@keydown\.enter="openNotification\(item\)"/);
});

test("NotificationList marks clickable notifications with dynamic role and tabindex", () => {
  assert.match(listSource, /:role="isClickable\(item\) \? 'button' : undefined"/);
  assert.match(listSource, /:tabindex="isClickable\(item\) \? 0 : undefined"/);
});

test("NotificationList applies is-clickable class for supported target kinds", () => {
  assert.match(listSource, /'is-clickable':\s*isClickable\(item\)/);
});

test("NotificationList has cursor pointer style for clickable notifications", () => {
  assert.match(listSource, /\.messages-view__notification\.is-clickable/);
  assert.match(listSource, /cursor:\s*pointer/);
});
test("NotificationList does not emit open-item for non-clickable fallback notifications", () => {
  const fallbackClassIdx = listSource.indexOf("'is-fallback': item.target?.kind === 'none'");
  const emitIdx = listSource.indexOf('if (isClickable(item)) emit("open-item", item)');
  assert.ok(fallbackClassIdx >= 0, "fallback notifications should render as non-clickable cards");
  assert.ok(emitIdx >= 0, "open-item emit should stay behind the isClickable guard");
  assert.match(listSource, /:data-target-kind="item\.target\?\.kind \|\| 'none'"/);
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
