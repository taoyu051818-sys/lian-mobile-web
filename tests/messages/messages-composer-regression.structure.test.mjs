import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- MessagesView declarative chrome ---

test("MessagesView declares pageChrome computed for shell chrome", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.match(src, /const pageChrome = computed<PageChromeSpec>/);
});

test("MessagesView emits chrome spec via watcher", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.match(src, /watch\(pageChrome.*emit\("chrome"/);
});

test("MessagesView declares tab spec with onTabSelect handler", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.match(src, /onTabSelect/);
  assert.match(src, /ariaLabel:\s*"消息分类"/);
});

test("MessagesView sets bottom visible based on active tab", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.match(src, /visible:\s*activeTab\.value\s*===\s*"channel"/);
});

test("MessagesView does not use floating chrome controller", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.doesNotMatch(src, /useFloatingChromeController/);
});

test("MessagesView does not use floating chrome CSS attributes", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.doesNotMatch(src, /data-floating-chrome/);
  assert.doesNotMatch(src, /data-floating-state/);
});

// --- ChannelComposer structure ---

test("ChannelComposer has compact and expanded states", () => {
  const src = read("src/features/messages/ChannelComposer.vue");
  assert.match(src, /is-compact/);
});

test("ChannelComposer includes textarea for message input", () => {
  const src = read("src/features/messages/ChannelComposer.vue");
  assert.match(src, /<textarea/);
});

test("ChannelComposer uses consistent button radius in compact state", () => {
  const src = read("src/features/messages/ChannelComposer.vue");
  assert.match(src, /var\(--radius-button\)/);
});

test("ChannelComposer does not duplicate glass visual styles from parent chrome", () => {
  const src = read("src/features/messages/ChannelComposer.vue");
  assert.doesNotMatch(src, /border-radius:\s*var\(--radius-card\)/);
  assert.doesNotMatch(src, /background:\s*rgba\(255,\s*255,\s*255,\s*0\.48\)/);
});

// --- MessagesView layout mode ---

test("messages view uses composer-safe layout mode", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /messages:\s*"composer-safe"/);
});

test("content-frame.css composer-safe modifier exists", () => {
  const css = read("src/shell/content-frame.css");
  assert.match(css, /\.content-frame--composer-safe/);
});

// --- ChannelThread clears fixed composer ---

test("ChannelThread bottom padding clears the fixed composer", () => {
  const src = read("src/features/messages/ChannelThread.vue");
  assert.match(src, /padding-bottom:\s*calc\(/);
});
