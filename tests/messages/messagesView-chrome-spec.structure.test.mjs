import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const viewSource = fs.readFileSync(path.join(repoRoot, "src/views/MessagesView.vue"), "utf8");
const tabsSource = fs.readFileSync(path.join(repoRoot, "src/views/messages/MessagesTabs.vue"), "utf8");
const composerSource = fs.readFileSync(path.join(repoRoot, "src/views/messages/ChannelComposer.vue"), "utf8");

test("MessagesView declares chrome emit for shell bottom tab bar control", () => {
  assert.match(viewSource, /defineEmits/);
  assert.match(viewSource, /chrome:\s*\[hidden:\s*boolean\]/);
});

test("MessagesView emits chrome true on mount to hide app bottom tab bar", () => {
  assert.match(viewSource, /emit\("chrome",\s*true\)/);
});

test("MessagesView emits chrome false on unmount to restore app bottom tab bar", () => {
  assert.match(viewSource, /onBeforeUnmount/);
  assert.match(viewSource, /emit\("chrome",\s*false\)/);
});

test("MessagesView uses floating chrome controller for composer lifecycle", () => {
  assert.match(viewSource, /useFloatingChromeController/);
  assert.match(viewSource, /composerChrome/);
  assert.match(viewSource, /composerChromePhase/);
  assert.match(viewSource, /composerChromeStyle/);
});

test("MessagesView hides bottom tab bar when switching to channel tab", () => {
  assert.match(viewSource, /composerChrome\.show\(\)/);
  assert.match(viewSource, /emit\("chrome",\s*true\)/);
});

test("MessagesView shows bottom tab bar when switching to notifications tab", () => {
  assert.match(viewSource, /composerChrome\.hide\(\)/);
  assert.match(viewSource, /emit\("chrome",\s*false\)/);
});

test("MessagesTabs renders as shell top chrome with floating chrome classes", () => {
  assert.match(viewSource, /lian-floating-chrome\s+lian-floating-chrome--top/);
  assert.match(viewSource, /data-floating-chrome="top"/);
  assert.match(viewSource, /data-floating-state="visible"/);
});

test("ChannelComposer renders as shell bottom chrome with floating chrome classes", () => {
  assert.match(viewSource, /lian-floating-chrome\s+lian-floating-chrome--bottom/);
  assert.match(viewSource, /data-floating-chrome="bottom"/);
  assert.match(viewSource, /:data-floating-state="composerChromePhase"/);
});

test("MessagesView positions MessagesTabs as fixed top chrome", () => {
  assert.match(viewSource, /\.messages-view__chrome-tabs/);
  assert.match(viewSource, /position:\s*fixed/);
});

test("MessagesView positions ChannelComposer as fixed bottom chrome", () => {
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
