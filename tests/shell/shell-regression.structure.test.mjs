import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- AppShell structure ---

test("AppShell renders both top and bottom ShellChrome regions", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /region="top"/);
  assert.match(src, /region="bottom"/);
});

test("AppShell passes layoutMode to ContentFrame", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /:layout-mode="layoutMode"/);
});

test("AppShell wraps view content in ContentFrame > PageSurface", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /<ContentFrame/);
  assert.match(src, /<PageSurface/);
});

test("AppShell binds floating chrome data attributes on bottom region", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /data-floating-state="bottomChromeState"/);
});

test("AppShell re-shows bottom chrome on tab change to prevent stale hidden state", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /appBottomChrome\.show\(\)/);
});

// --- ShellChrome structure ---

test("ShellChrome computes floatingState from chromePhase prop", () => {
  const src = read("src/shell/ShellChrome.vue");
  assert.match(src, /const floatingState = computed\(/);
});

test("ShellChrome disables buttons during transition to prevent ghost taps", () => {
  const src = read("src/shell/ShellChrome.vue");
  assert.match(src, /:disabled="btn\.disabled \|\| isTransitioning"/);
});

test("ShellChrome renders bottom tab bar in bottom region", () => {
  const src = read("src/shell/AppShell.vue");
  assert.match(src, /<BottomTabBar/);
});

// --- Shell chrome CSS ---

test("shell-chrome.css uses safe-area insets for top and bottom padding", () => {
  const css = read("src/shell/shell-chrome.css");
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("shell-chrome.css has reduced-motion block for tab transitions", () => {
  const css = read("src/shell/shell-chrome.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

// --- View layout mode assignment ---

test("view-types assigns full-bleed to map and composer-safe to messages", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /map:\s*"full-bleed"/);
  assert.match(src, /messages:\s*"composer-safe"/);
});

test("view-types assigns content mode to feed, publish, and profile", () => {
  const src = read("src/app/view-types.ts");
  assert.match(src, /feed:\s*"content"/);
  assert.match(src, /publish:\s*"content"/);
  assert.match(src, /profile:\s*"content"/);
});
