import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readShellSource(name) {
  return fs.readFileSync(path.join(repoRoot, "src/shell", name), "utf8");
}

// -- ContentFrame.vue --

test("ContentFrame exposes layoutMode prop with ShellLayoutMode type", () => {
  const src = readShellSource("ContentFrame.vue");
  assert.match(src, /layoutMode\?\s*:\s*ShellLayoutMode/);
});

test("ContentFrame defaults layoutMode to content", () => {
  const src = readShellSource("ContentFrame.vue");
  assert.match(src, /layoutMode:\s*"content"/);
});

test("ContentFrame renders a default slot", () => {
  const src = readShellSource("ContentFrame.vue");
  assert.match(src, /<slot\s*\/>/);
});

test("ContentFrame applies content-frame base class", () => {
  const src = readShellSource("ContentFrame.vue");
  assert.match(src, /class="content-frame/);
});

test("ContentFrame applies backward-compat vue-shell__grid class", () => {
  const src = readShellSource("ContentFrame.vue");
  assert.match(src, /vue-shell__grid/);
});

test("ContentFrame applies layout mode modifier classes", () => {
  const src = readShellSource("ContentFrame.vue");
  assert.match(src, /content-frame--\$\{layoutMode\}/);
  assert.match(src, /vue-shell__grid--\$\{layoutMode\}/);
});

test("ContentFrame uses role=region for accessibility", () => {
  const src = readShellSource("ContentFrame.vue");
  assert.match(src, /role="region"/);
});

// -- content-frame.css --

test("content-frame.css defines base content-frame styles", () => {
  const css = readShellSource("content-frame.css");
  assert.match(css, /\.content-frame\s*\{/);
});

test("content-frame.css defines full-bleed modifier", () => {
  const css = readShellSource("content-frame.css");
  assert.match(css, /\.content-frame--full-bleed/);
});

test("content-frame.css defines composer-safe modifier", () => {
  const css = readShellSource("content-frame.css");
  assert.match(css, /\.content-frame--composer-safe/);
});

test("content-frame.css uses CSS custom properties", () => {
  const css = readShellSource("content-frame.css");
  assert.match(css, /var\(--space-/);
});

// -- shell/index.ts exports --

test("shell/index.ts exports ContentFrame", () => {
  const indexSrc = fs.readFileSync(path.join(repoRoot, "src/shell/index.ts"), "utf8");
  assert.match(
    indexSrc,
    /export\s*\{\s*default\s+as\s+ContentFrame\s*\}\s*from\s*"\.\/ContentFrame\.vue"/,
  );
});

// -- main.css imports content-frame.css --

test("main.css imports content-frame.css", () => {
  const mainCss = fs.readFileSync(path.join(repoRoot, "src/styles/main.css"), "utf8");
  assert.match(mainCss, /@import\s*"\.\.\/shell\/content-frame\.css"/);
});
