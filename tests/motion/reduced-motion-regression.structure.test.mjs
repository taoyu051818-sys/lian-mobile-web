import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- Shared reduced motion utility ---

test("useReducedMotion.ts exports reactive composable and one-shot helper", () => {
  const src = read("src/motion/useReducedMotion.ts");
  assert.match(src, /export function useReducedMotion\(\)/);
  assert.match(src, /export function prefersReducedMotion\(\):\s*boolean/);
});

test("useReducedMotion is SSR-safe with window and matchMedia guards", () => {
  const src = read("src/motion/useReducedMotion.ts");
  assert.match(src, /typeof window === "undefined"/);
  assert.match(src, /window\.matchMedia\?/);
});

test("useReducedMotion listens for runtime preference changes", () => {
  const src = read("src/motion/useReducedMotion.ts");
  assert.match(src, /addEventListener\("change"/);
  assert.match(src, /removeEventListener\("change"/);
});

test("useReducedMotion cleans up listener on unmount", () => {
  const src = read("src/motion/useReducedMotion.ts");
  assert.match(src, /onBeforeUnmount/);
});

// --- Floating chrome CSS reduced-motion ---

test("floating-chrome.css has prefers-reduced-motion block", () => {
  const css = read("src/styles/floating-chrome.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("floating-chrome reduced-motion enforces transition:none, transform:none, filter:none", () => {
  const css = read("src/styles/floating-chrome.css");
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /transition:\s*none\s*!/);
  assert.match(rmBlock, /transform:\s*none\s*!/);
  assert.match(rmBlock, /filter:\s*none\s*!/);
});

test("floating-chrome reduced-motion sets hidden states to opacity:0", () => {
  const css = read("src/styles/floating-chrome.css");
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /\[data-floating-state="hidden"\][\s\S]*?opacity:\s*0\s*!/);
});

test("floating-chrome reduced-motion sets visible states to opacity:1", () => {
  const css = read("src/styles/floating-chrome.css");
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /\[data-floating-state="visible"\][\s\S]*?opacity:\s*1\s*!/);
});

// --- Shell chrome CSS reduced-motion ---

test("shell-chrome.css has reduced-motion block for tab transitions", () => {
  const css = read("src/shell/shell-chrome.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("shell-chrome reduced-motion disables tab transitions", () => {
  const css = read("src/shell/shell-chrome.css");
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /transition:\s*none/);
});

// --- Content immersive UI reduced-motion ---

test("content-immersive-ui.css has reduced-motion block", () => {
  const css = read("src/styles/content-immersive-ui.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("content-immersive-ui reduced-motion disables transitions on interactive elements", () => {
  const css = read("src/styles/content-immersive-ui.css");
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /transition:\s*none/);
});

// --- FeedView reduced-motion usage ---

test("FeedView imports prefersReducedMotion from shared module", () => {
  const src = read("src/views/FeedView.vue");
  assert.match(src, /import.*prefersReducedMotion.*from.*motion\/useReducedMotion/);
  assert.doesNotMatch(src, /function prefersReducedMotion\(\)/);
});

test("FeedView short-circuits detail motion when reduced motion is active", () => {
  const src = read("src/views/FeedView.vue");
  assert.match(src, /prefersReducedMotion\(\)/);
});

// --- MessagesView reduced-motion awareness ---

test("MessagesView uses declarative chrome (no floating chrome data attributes)", () => {
  const src = read("src/views/MessagesView.vue");
  assert.doesNotMatch(src, /data-floating-state/);
  assert.match(src, /PageChromeSpec/);
});
