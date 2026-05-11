import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readTokens() {
  return fs.readFileSync(path.join(repoRoot, "src/styles/lian-tokens.css"), "utf8");
}

function readSheet() {
  return fs.readFileSync(path.join(repoRoot, "src/ui/Sheet.vue"), "utf8");
}

function readDetailSheet() {
  return fs.readFileSync(path.join(repoRoot, "src/shell/DetailSheet.vue"), "utf8");
}

function readToastHost() {
  return fs.readFileSync(path.join(repoRoot, "src/ui/feedback/ToastHost.vue"), "utf8");
}

function readPrimitivesCss() {
  return fs.readFileSync(path.join(repoRoot, "src/ui/primitives.css"), "utf8");
}

function readDetailSheetCss() {
  return fs.readFileSync(path.join(repoRoot, "src/shell/detail-sheet.css"), "utf8");
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

test("z-index tokens are ordered chrome < detail-sheet < sheet < toast", () => {
  const tokens = readTokens();
  const chrome = tokens.match(/--z-chrome:\s*(\d+)/)?.[1];
  const detail = tokens.match(/--z-detail-sheet:\s*(\d+)/)?.[1];
  const sheet = tokens.match(/--z-sheet:\s*(\d+)/)?.[1];
  const toast = tokens.match(/--z-toast:\s*(\d+)/)?.[1];
  assert.ok(Number(chrome) < Number(detail), "chrome < detail-sheet");
  assert.ok(Number(detail) < Number(sheet), "detail-sheet < sheet");
  assert.ok(Number(sheet) < Number(toast), "sheet < toast");
});

// --- Sheet.vue contract ---

test("Sheet uses Teleport to body", () => {
  assert.match(readSheet(), /<Teleport\s+to="body">/);
});

test("Sheet uses role=dialog", () => {
  assert.match(readSheet(), /role="dialog"/);
});

test("Sheet uses aria-modal=true", () => {
  assert.match(readSheet(), /aria-modal="true"/);
});

test("Sheet handles Escape key", () => {
  assert.match(readSheet(), /Escape/);
});

test("Sheet locks body scroll when open", () => {
  const src = readSheet();
  assert.match(src, /overflow.*hidden/);
});

test("Sheet cleans up scroll lock and keydown on unmount", () => {
  const src = readSheet();
  assert.match(src, /onBeforeUnmount/);
  assert.match(src, /unlockScroll/);
  assert.match(src, /removeEventListener.*keydown/);
});

test("Sheet returns focus to trigger element on close", () => {
  const src = readSheet();
  assert.match(src, /triggerEl/);
  assert.match(src, /triggerEl\?\.focus\(\)/);
});

// --- DetailSheet.vue contract ---

test("DetailSheet uses Teleport to body", () => {
  assert.match(readDetailSheet(), /<Teleport\s+to="body">/);
});

test("DetailSheet uses role=dialog", () => {
  assert.match(readDetailSheet(), /role="dialog"/);
});

test("DetailSheet uses aria-modal=true", () => {
  assert.match(readDetailSheet(), /aria-modal="true"/);
});

test("DetailSheet handles Escape key", () => {
  assert.match(readDetailSheet(), /Escape/);
});

test("DetailSheet locks body scroll when open", () => {
  const src = readDetailSheet();
  assert.match(src, /overflow.*hidden/);
});

test("DetailSheet cleans up scroll lock and keydown on unmount", () => {
  const src = readDetailSheet();
  assert.match(src, /onBeforeUnmount/);
  assert.match(src, /unlockScroll/);
  assert.match(src, /removeEventListener.*keydown/);
});

test("DetailSheet returns focus to trigger element on close", () => {
  const src = readDetailSheet();
  assert.match(src, /triggerEl/);
  assert.match(src, /triggerEl\?\.focus\(\)/);
});

// --- ToastHost.vue contract ---

test("ToastHost uses Teleport to body", () => {
  assert.match(readToastHost(), /<Teleport\s+to="body">/);
});

test("ToastHost has aria-live polite", () => {
  assert.match(readToastHost(), /aria-live="polite"/);
});

// --- CSS token usage ---

test("primitives.css Sheet uses --z-sheet token", () => {
  assert.match(readPrimitivesCss(), /\.lian-sheet\s*\{[\s\S]*?z-index:\s*var\(--z-sheet\)/);
});

test("primitives.css toast-host uses --z-toast token", () => {
  assert.match(readPrimitivesCss(), /\.toast-host\s*\{[\s\S]*?z-index:\s*var\(--z-toast\)/);
});

test("detail-sheet.css uses --z-detail-sheet token", () => {
  assert.match(readDetailSheetCss(), /z-index:\s*var\(--z-detail-sheet\)/);
});

// --- Layer ordering invariant ---

test("overlay layers maintain correct stacking order", () => {
  // chrome (70) < detail-sheet (90) < sheet (100) < toast (200)
  // Verify no hardcoded z-index values override the token order in shared CSS
  const primitives = readPrimitivesCss();
  const detailCss = readDetailSheetCss();

  // Sheet should not have a hardcoded z-index (must use token)
  const sheetBlock = primitives.slice(primitives.indexOf(".lian-sheet {"));
  assert.doesNotMatch(sheetBlock, /z-index:\s*\d+;/);

  // Toast should not have a hardcoded z-index (must use token)
  const toastBlock = primitives.slice(primitives.indexOf(".toast-host {"));
  assert.doesNotMatch(toastBlock, /z-index:\s*\d+;/);

  // Detail sheet should not have a hardcoded z-index (must use token)
  assert.doesNotMatch(detailCss, /z-index:\s*\d+;/);
});
