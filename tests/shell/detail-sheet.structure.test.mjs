import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readShellSource(name) {
  return fs.readFileSync(path.join(repoRoot, "src/shell", name), "utf8");
}

// -- DetailSheet.vue --

test("DetailSheet uses Teleport to body", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /<Teleport\s+to="body">/);
});

test("DetailSheet uses role=dialog for accessibility", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /role="dialog"/);
});

test("DetailSheet uses aria-modal=true", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /aria-modal="true"/);
});

test("DetailSheet renders a default slot with kind and payload", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /<slot\s+:kind="state\.kind"\s+:payload="state\.payload"\s*\/>/);
});

test("DetailSheet renders a header slot", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /<slot\s+name="header">/);
});

test("DetailSheet imports useDetailSheet composable", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /import\s*\{\s*useDetailSheet\s*\}\s*from\s*"\.\/useDetailSheet"/);
});

test("DetailSheet has a close button with aria-label", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /aria-label="关闭"/);
});

test("DetailSheet emits close event", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /emit\(["']close["']\)/);
});

test("DetailSheet handles Escape key", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /Escape/);
});

test("DetailSheet cleans up keydown listener on unmount", () => {
  const src = readShellSource("DetailSheet.vue");
  assert.match(src, /onBeforeUnmount/);
  assert.match(src, /removeEventListener.*keydown/);
});

// -- detail-sheet.css --

test("detail-sheet.css defines overlay styles", () => {
  const css = readShellSource("detail-sheet.css");
  assert.match(css, /\.detail-sheet-overlay\s*\{/);
});

test("detail-sheet.css uses fixed positioning", () => {
  const css = readShellSource("detail-sheet.css");
  assert.match(css, /position:\s*fixed/);
});

test("detail-sheet.css defines panel with glassmorphism", () => {
  const css = readShellSource("detail-sheet.css");
  assert.match(css, /backdrop-filter/);
  assert.match(css, /var\(--glass-blur\)/);
});

test("detail-sheet.css uses design tokens", () => {
  const css = readShellSource("detail-sheet.css");
  assert.match(css, /var\(--radius-sheet\)/);
  assert.match(css, /var\(--shadow-glass\)/);
});

test("detail-sheet.css defines body scroll area", () => {
  const css = readShellSource("detail-sheet.css");
  assert.match(css, /\.detail-sheet__body/);
  assert.match(css, /overflow-y:\s*auto/);
});

test("detail-sheet.css supports reduced motion", () => {
  const css = readShellSource("detail-sheet.css");
  assert.match(css, /prefers-reduced-motion/);
});

// -- shell/index.ts exports --

test("shell/index.ts exports DetailSheet", () => {
  const indexSrc = fs.readFileSync(path.join(repoRoot, "src/shell/index.ts"), "utf8");
  assert.match(indexSrc, /export\s*\{\s*default\s+as\s+DetailSheet\s*\}\s*from\s*"\.\/DetailSheet\.vue"/);
});

test("shell/index.ts exports useDetailSheet", () => {
  const indexSrc = fs.readFileSync(path.join(repoRoot, "src/shell/index.ts"), "utf8");
  assert.match(indexSrc, /export\s*\{\s*useDetailSheet\s*\}\s*from\s*"\.\/useDetailSheet"/);
});

test("shell/index.ts exports createDefaultDetailSheetState", () => {
  const indexSrc = fs.readFileSync(path.join(repoRoot, "src/shell/index.ts"), "utf8");
  assert.match(indexSrc, /export\s*\{\s*createDefaultDetailSheetState\s*\}\s*from\s*"\.\/detail-sheet-types"/);
});

test("shell/index.ts exports DetailSheetKind type", () => {
  const indexSrc = fs.readFileSync(path.join(repoRoot, "src/shell/index.ts"), "utf8");
  assert.match(indexSrc, /DetailSheetKind/);
});

// -- main.css imports detail-sheet.css --

test("main.css imports detail-sheet.css", () => {
  const mainCss = fs.readFileSync(path.join(repoRoot, "src/styles/main.css"), "utf8");
  assert.match(mainCss, /@import\s*"\.\.\/shell\/detail-sheet\.css"/);
});
