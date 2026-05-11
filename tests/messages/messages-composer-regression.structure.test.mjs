import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- MessagesView floating chrome lifecycle ---

test("MessagesView creates a floating chrome controller for composer", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /useFloatingChromeController/);
  assert.match(src, /composerChrome/);
});

test("MessagesView disposes floating chrome controller on unmount", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /onBeforeUnmount/);
  assert.match(src, /composerChrome\.dispose\(\)/);
});

test("MessagesView shows composer chrome on channel tab, hides on notifications tab", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /composerChrome\.show\(\)/);
  assert.match(src, /composerChrome\.hide\(\)/);
});

test("MessagesView emits chrome event to hide/show shell bottom tab bar", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /chrome:\s*\[hidden:\s*boolean\]/);
});

// --- MessagesView floating chrome CSS classes ---

test("MessagesView renders MessagesTabs as top floating chrome", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /lian-floating-chrome\s+lian-floating-chrome--top/);
  assert.match(src, /data-floating-chrome="top"/);
});

test("MessagesView renders ChannelComposer as bottom floating chrome", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /lian-floating-chrome\s+lian-floating-chrome--bottom/);
  assert.match(src, /data-floating-chrome="bottom"/);
});

test("MessagesView binds composer floating state to chrome phase", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /:data-floating-state="composerChromePhase"/);
});

// --- ChannelComposer structure ---

test("ChannelComposer has compact and expanded states", () => {
  const src = read("src/views/messages/ChannelComposer.vue");
  assert.match(src, /is-compact/);
});

test("ChannelComposer includes textarea for message input", () => {
  const src = read("src/views/messages/ChannelComposer.vue");
  assert.match(src, /<textarea/);
});

test("ChannelComposer uses consistent button radius in compact state", () => {
  const src = read("src/views/messages/ChannelComposer.vue");
  assert.match(src, /var\(--radius-button\)/);
});

test("ChannelComposer does not duplicate glass visual styles from parent chrome", () => {
  const src = read("src/views/messages/ChannelComposer.vue");
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
  const src = read("src/views/messages/ChannelThread.vue");
  assert.match(src, /padding-bottom:\s*calc\(/);
});
