import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- Design tokens: safe-area offset variables ---

test("lian-tokens.css defines --floating-bar-top-offset with safe-area-inset-top", () => {
  const css = read("src/styles/lian-tokens.css");
  assert.match(css, /--floating-bar-top-offset/);
  assert.match(css, /env\(safe-area-inset-top\)/);
});

test("lian-tokens.css defines --floating-bar-bottom-offset with safe-area-inset-bottom", () => {
  const css = read("src/styles/lian-tokens.css");
  assert.match(css, /--floating-bar-bottom-offset/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

// --- Main shell grid: safe-area padding ---

test("main.css .vue-shell applies safe-area top padding", () => {
  const css = read("src/styles/main.css");
  const vueShell = css.slice(css.indexOf(".vue-shell"));
  assert.match(vueShell, /env\(safe-area-inset-top\)/);
});

test("main.css .vue-shell applies safe-area bottom padding for tab bar clearance", () => {
  const css = read("src/styles/main.css");
  const vueShell = css.slice(css.indexOf(".vue-shell"));
  assert.match(vueShell, /env\(safe-area-inset-bottom\)/);
});

test("primitives.css .page-surface--padded respects safe-area bottom", () => {
  const css = read("src/ui/primitives.css");
  assert.match(css, /page-surface--padded[\s\S]*?env\(safe-area-inset-bottom\)/);
});

// --- Shell chrome: top and bottom safe-area padding ---

test("shell-chrome.css top region pads for safe-area-inset-top", () => {
  const css = read("src/shell/shell-chrome.css");
  const topBlock = css.slice(css.indexOf(".shell-chrome--top"));
  assert.match(topBlock, /env\(safe-area-inset-top\)/);
});

test("shell-chrome.css bottom region pads for safe-area-inset-bottom", () => {
  const css = read("src/shell/shell-chrome.css");
  const bottomBlock = css.slice(css.indexOf(".shell-chrome--bottom"));
  assert.match(bottomBlock, /env\(safe-area-inset-bottom\)/);
});

// --- Floating chrome: side inset with safe-area fallback ---

test("floating-chrome.css uses max() for side insets with safe-area fallback", () => {
  const css = read("src/styles/floating-chrome.css");
  assert.match(css, /max\(var\(--floating-bar-side-inset\),\s*env\(safe-area-inset-right\)\)/);
  assert.match(css, /max\(var\(--floating-bar-side-inset\),\s*env\(safe-area-inset-left\)\)/);
});

// --- Bottom tab bar: safe-area positioning ---

test("primitives.css bottom tab bar respects all three safe-area insets", () => {
  const css = read("src/ui/primitives.css");
  assert.match(css, /env\(safe-area-inset-right\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-left\)/);
});

// --- Toast host: safe-area top offset ---

test("primitives.css toast host offsets by safe-area-inset-top", () => {
  const css = read("src/ui/primitives.css");
  assert.match(css, /env\(safe-area-inset-top\)/);
});

// --- Messages view: safe-area spacing ---

test("MessagesView applies safe-area top padding for floating tabs", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /env\(safe-area-inset-top\)/);
});

test("MessagesView applies safe-area bottom padding", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /env\(safe-area-inset-bottom\)/);
});

test("MessagesView positions composer with floating-bar-bottom-offset (includes safe-area)", () => {
  const src = read("src/views/MessagesView.vue");
  assert.match(src, /--floating-bar-bottom-offset/);
  assert.match(src, /--keyboard-inset-bottom/);
});

// --- ChannelThread: clears fixed composer with safe-area-aware padding ---

test("ChannelThread bottom padding accounts for safe-area-inset-bottom", () => {
  const src = read("src/views/messages/ChannelThread.vue");
  assert.match(src, /env\(safe-area-inset-bottom\)/);
});

// --- Map view: post detail safe-area clearance ---

test("MapView post-detail panel uses safe-area-inset-bottom for clearance", () => {
  const src = read("src/views/MapView.vue");
  assert.match(src, /env\(safe-area-inset-bottom\)/);
});
