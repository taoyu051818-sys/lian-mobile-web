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
const composerSource = fs.readFileSync(
  path.join(repoRoot, "src/features/messages/ChannelComposer.vue"),
  "utf8",
);

test("MessagesView declares chrome emit with PageChromeSpec type", () => {
  assert.match(viewSource, /defineEmits/);
  assert.match(viewSource, /chrome:\s*\[spec:\s*PageChromeSpec\]/);
});

test("MessagesView uses declarative pageChrome computed instead of floating chrome controller", () => {
  assert.match(viewSource, /const pageChrome = computed<PageChromeSpec>/);
  assert.doesNotMatch(viewSource, /useFloatingChromeController/);
});

test("MessagesView delegates top filtering to ChannelFilterBar", () => {
  assert.match(viewSource, /slot:\s*"channel-filter"/);
  assert.match(viewSource, /<ChannelFilterBar/);
  assert.doesNotMatch(viewSource, /onTabSelect/);
});

test("MessagesView keeps the bottom shell chrome visible across all tabs so the bottom nav stays tappable", () => {
  // Issue #799: previously bottom.visible was gated on activeTab === "channel",
  // which gave the BottomTabBar host pointer-events:none on system / orders /
  // replies. Keep this as a constant `true` so taps on 我的 / 首页 land.
  assert.match(viewSource, /bottom:\s*\{\s*visible:\s*true,?\s*\}/);
  assert.doesNotMatch(viewSource, /visible:\s*activeTab\.value\s*===\s*"channel"/);
});

test("MessagesView does not use floating chrome CSS attributes", () => {
  assert.doesNotMatch(viewSource, /data-floating-chrome/);
  assert.doesNotMatch(viewSource, /data-floating-state/);
  assert.doesNotMatch(viewSource, /lian-floating-chrome/);
});

test("MessagesView positions ChannelComposer with chrome-composer class", () => {
  assert.match(viewSource, /\.messages-view__chrome-composer/);
});

test("ChannelComposer root does not duplicate glass visual styles from parent chrome", () => {
  assert.doesNotMatch(composerSource, /border-radius:\s*var\(--radius-card\)/);
  assert.doesNotMatch(composerSource, /background:\s*rgba\(255,\s*255,\s*255,\s*0\.48\)/);
});
