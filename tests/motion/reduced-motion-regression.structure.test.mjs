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
  const src = read("src/composables/useReducedMotion.ts");
  assert.match(src, /export function useReducedMotion\(\)/);
  assert.match(src, /export function prefersReducedMotion\(\):\s*boolean/);
});

test("useReducedMotion is SSR-safe with window and matchMedia guards", () => {
  const src = read("src/composables/useReducedMotion.ts");
  assert.match(src, /typeof window === "undefined"/);
  assert.match(src, /window\.matchMedia\?/);
});

test("useReducedMotion listens for runtime preference changes", () => {
  const src = read("src/composables/useReducedMotion.ts");
  assert.match(src, /addEventListener\("change"/);
  assert.match(src, /removeEventListener\("change"/);
});

test("useReducedMotion cleans up listener on unmount", () => {
  const src = read("src/composables/useReducedMotion.ts");
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

test("floating-chrome CSS does not use data-floating-state selectors (declarative pattern)", () => {
  const css = read("src/styles/floating-chrome.css");
  assert.doesNotMatch(css, /\[data-floating-state/);
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

// --- FeedView reduced-motion: declarative chrome takes over from JS short-circuits ---
// Earlier versions short-circuited detail open/close in JS via prefersReducedMotion().
// Since PR #599, FeedView routes detail phase through useFloatingChromeState().setDetailPhase(),
// and the actual motion suppression lives in CSS (chrome-surface.css + shell-chrome.css
// reduced-motion blocks). The JS short-circuit is no longer needed.

test("FeedView routes detail phase through floating chrome state (no JS reduced-motion short-circuit)", () => {
  const src = read("src/features/feed/FeedView.vue");
  assert.match(src, /useFloatingChromeState\(\)/);
  assert.match(src, /setDetailPhase\(/);
  assert.doesNotMatch(src, /function prefersReducedMotion\(\)/);
});

// --- MessagesView reduced-motion awareness ---

test("MessagesView uses declarative chrome (no floating chrome data attributes)", () => {
  const src = read("src/features/messages/MessagesView.vue");
  assert.doesNotMatch(src, /data-floating-state/);
  assert.match(src, /PageChromeSpec/);
});

// --- Motion token consumption: every transition must reference a --motion-* var ---
// Hard-coded durations / easings drift over time and break the "everything moves
// together" feel of Dynamic Island. Guard the surfaces that own real motion.

const motionTrackedFiles = [
  "src/features/map/map-canvas.css",
  "src/shell/shell-chrome.css",
  "src/styles/content-immersive-ui.css",
  "src/features/feed/FeedItemCard.vue",
];

for (const rel of motionTrackedFiles) {
  test(`${rel} has no hard-coded transition duration (must use --motion-* token)`, () => {
    const src = read(rel);
    // Match `transition` / `transition-duration` declarations with a literal time
    // (e.g. `0.15s`, `220ms`). Allow `transition: none` and var(--motion-...).
    const offenders = [];
    const re = /transition(?:-duration)?:\s*([^;}]+)[;}]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const value = m[1];
      if (/^\s*none\s*$/.test(value)) continue;
      if (/var\(--motion-/.test(value)) continue;
      // Tolerate transitions that reference a chained custom prop resolving to --motion-*
      if (/var\(--floating-chrome-motion-duration/.test(value)) continue;
      if (/\b\d+(?:\.\d+)?(?:ms|s)\b/.test(value)) {
        offenders.push(value.trim());
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `hard-coded transition durations in ${rel}: ${offenders.join(" | ")}`,
    );
  });
}
