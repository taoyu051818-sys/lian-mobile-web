import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readTokens() {
  return fs.readFileSync(path.join(repoRoot, "src/styles/lian-tokens.css"), "utf8");
}

function readDetailSurface() {
  return fs.readFileSync(path.join(repoRoot, "src/app/DetailSurface.vue"), "utf8");
}

function readToastHost() {
  return fs.readFileSync(path.join(repoRoot, "src/ui/feedback/ToastHost.vue"), "utf8");
}

function readPrimitivesCss() {
  return fs.readFileSync(path.join(repoRoot, "src/ui/primitives.css"), "utf8");
}

function readFeedContextMenu() {
  return fs.readFileSync(path.join(repoRoot, "src/features/feed/FeedContextMenu.vue"), "utf8");
}

// --- z-index token scale ---

test("lian-tokens.css defines --z-chrome token", () => {
  assert.match(readTokens(), /--z-chrome:\s*70/);
});

test("lian-tokens.css defines --z-detail-sheet token", () => {
  assert.match(readTokens(), /--z-detail-sheet:\s*90/);
});

test("lian-tokens.css defines --z-sheet token", () => {
  assert.match(readTokens(), /--z-sheet:\s*100/);
});

test("lian-tokens.css defines --z-toast token", () => {
  assert.match(readTokens(), /--z-toast:\s*200/);
});

test("--floating-bar-z aliases --z-chrome for backward compat", () => {
  assert.match(readTokens(), /--floating-bar-z:\s*var\(--z-chrome\)/);
});

test("z-index tokens are ordered chrome < detail dock < context overlays < toast", () => {
  const tokens = readTokens();
  const chrome = tokens.match(/--z-chrome:\s*(\d+)/)?.[1];
  const detail = tokens.match(/--z-detail-sheet:\s*(\d+)/)?.[1];
  const sheet = tokens.match(/--z-sheet:\s*(\d+)/)?.[1];
  const toast = tokens.match(/--z-toast:\s*(\d+)/)?.[1];
  assert.ok(Number(chrome) < Number(detail), "chrome < detail dock");
  assert.ok(Number(detail) < Number(sheet), "detail dock < context overlays");
  assert.ok(Number(sheet) < Number(toast), "context overlays < toast");
});

// --- DetailSurface.vue contract ---

test("DetailSurface uses Teleport to body", () => {
  assert.match(readDetailSurface(), /<Teleport\s+to="body">/);
});

test("DetailSurface uses role=dialog", () => {
  assert.match(readDetailSurface(), /role="dialog"/);
});

test("DetailSurface uses aria-modal=true", () => {
  assert.match(readDetailSurface(), /aria-modal="true"/);
});

test("DetailSurface freezes host scrolling while open", () => {
  const src = readDetailSurface();
  assert.match(src, /setHostFrozen\(open\)/);
  assert.match(src, /:global\(body\.detail-surface-open\)[\s\S]*overflow:\s*hidden/);
});

// --- ToastHost.vue contract ---

test("ToastHost uses Teleport to body", () => {
  assert.match(readToastHost(), /<Teleport\s+to="body">/);
});

test("ToastHost has aria-live polite", () => {
  assert.match(readToastHost(), /aria-live="polite"/);
});

// --- CSS token usage ---

test("FeedContextMenu uses --z-sheet token", () => {
  assert.match(readFeedContextMenu(), /z-index:\s*var\(--z-sheet,\s*100\)/);
});

test("primitives.css toast-host uses --z-toast token", () => {
  assert.match(readPrimitivesCss(), /\.toast-host\s*\{[\s\S]*?z-index:\s*var\(--z-toast\)/);
});

test("DetailSurface dock uses --z-detail-sheet token", () => {
  assert.match(readDetailSurface(), /z-index:\s*var\(--z-detail-sheet\)/);
});

// --- Layer ordering invariant ---

test("overlay layers maintain correct stacking order", () => {
  // chrome (70) < detail dock (90) < context overlays (100) < toast (200)
  // Verify no hardcoded z-index values override the token order in shared CSS
  const primitives = readPrimitivesCss();
  const contextMenu = readFeedContextMenu();

  // Context overlays should not have a hardcoded z-index (must use token)
  assert.doesNotMatch(contextMenu, /z-index:\s*\d+;/);

  // Toast should not have a hardcoded z-index (must use token)
  const toastBlock = primitives.slice(primitives.indexOf(".toast-host {"));
  assert.doesNotMatch(toastBlock, /z-index:\s*\d+;/);
});
