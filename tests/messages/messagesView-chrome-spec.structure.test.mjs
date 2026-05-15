import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/views/MessagesView.vue"), "utf8");
const tabsSource = fs.readFileSync(path.join(repoRoot, "src/views/messages/MessagesTabs.vue"), "utf8");
const composerSource = fs.readFileSync(path.join(repoRoot, "src/views/messages/ChannelComposer.vue"), "utf8");

test("MessagesView declares chrome emit with PageChromeSpec type", () => {
  assert.match(viewSource, /defineEmits/);
  assert.match(viewSource, /chrome:\s*\[spec:\s*PageChromeSpec\]/);
});

test("MessagesView uses declarative pageChrome computed instead of floating chrome controller", () => {
  assert.match(viewSource, /const pageChrome = computed<PageChromeSpec>/);
  assert.doesNotMatch(viewSource, /useFloatingChromeController/);
});

test("MessagesView declares tab spec with onTabSelect handler", () => {
  assert.match(viewSource, /onTabSelect/);
  assert.match(viewSource, /ariaLabel:\s*"消息分类"/);
});

test("MessagesView sets bottom visible based on active tab", () => {
  assert.match(viewSource, /visible:\s*activeTab\.value\s*===\s*"channel"/);
});

test("MessagesView does not use floating chrome CSS attributes", () => {
  assert.doesNotMatch(viewSource, /data-floating-chrome/);
  assert.doesNotMatch(viewSource, /data-floating-state/);
  assert.doesNotMatch(viewSource, /lian-floating-chrome/);
});

test("MessagesView positions ChannelComposer with chrome-composer class", () => {
  assert.match(viewSource, /\.messages-view__chrome-composer/);
});

test("MessagesTabs tab buttons use floating chrome button pattern", () => {
  assert.match(tabsSource, /flex:\s*0\s+0\s+auto/);
  assert.match(tabsSource, /white-space:\s*nowrap/);
  assert.match(tabsSource, /border:\s*0/);
});

test("ChannelComposer root does not duplicate glass visual styles from parent chrome", () => {
  assert.doesNotMatch(composerSource, /border-radius:\s*var\(--radius-card\)/);
  assert.doesNotMatch(composerSource, /background:\s*rgba\(255,\s*255,\s*255,\s*0\.48\)/);
});
