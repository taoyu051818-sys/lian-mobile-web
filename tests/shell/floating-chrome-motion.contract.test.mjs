import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readCss() {
  return fs.readFileSync(path.join(repoRoot, "src/styles/floating-chrome.css"), "utf8");
}

// --- Reduced-motion contract ---

test("floating-chrome.css has a prefers-reduced-motion: reduce block", () => {
  const css = readCss();
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("reduced-motion block enforces transition:none on base floating chrome", () => {
  const css = readCss();
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /\.lian-floating-chrome[\s\S]*?transition:\s*none\s*!/);
});

test("reduced-motion block enforces transform:none on base floating chrome", () => {
  const css = readCss();
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /\.lian-floating-chrome[\s\S]*?transform:\s*none\s*!/);
});

test("reduced-motion block enforces filter:none on base floating chrome", () => {
  const css = readCss();
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /\.lian-floating-chrome[\s\S]*?filter:\s*none\s*!/);
});

test("reduced-motion block sets hidden/exiting states to opacity:0 with no transform or transition", () => {
  const css = readCss();
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /\[data-floating-state="hidden"\][\s\S]*?opacity:\s*0\s*!/);
  assert.match(rmBlock, /\[data-floating-state="exiting"\][\s\S]*?transform:\s*none\s*!/);
  assert.match(rmBlock, /\[data-floating-state="exiting"\][\s\S]*?transition:\s*none\s*!/);
});

test("reduced-motion block sets visible/entering/progress states to opacity:1 with no transform or transition", () => {
  const css = readCss();
  const rmBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rmBlock, /\[data-floating-state="visible"\][\s\S]*?opacity:\s*1\s*!/);
  assert.match(rmBlock, /\[data-floating-state="visible"\][\s\S]*?transform:\s*none\s*!/);
  assert.match(rmBlock, /\[data-floating-state="entering"\][\s\S]*?opacity:\s*1\s*!/);
  assert.match(rmBlock, /\[data-floating-state="progress"\][\s\S]*?opacity:\s*1\s*!/);
});

// --- State selector contract ---

test("floating-chrome.css defines data-floating-state selectors for all lifecycle phases", () => {
  const css = readCss();
  // Outside reduced-motion block, check the main selectors exist
  const beforeRm = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
  for (const state of ["visible", "exiting", "hidden", "entering", "progress"]) {
    assert.match(
      beforeRm,
      new RegExp(`data-floating-state="${state}"`),
      `missing [data-floating-state="${state}"] selector`,
    );
  }
});

test("hidden/exiting states enforce opacity:0 and pointer-events:none", () => {
  const css = readCss();
  const beforeRm = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(beforeRm, /\[data-floating-state="hidden"\][\s\S]*?opacity:\s*0\s*!/);
  assert.match(beforeRm, /\[data-floating-state="exiting"\][\s\S]*?pointer-events:\s*none\s*!/);
});

test("visible/entering states enforce opacity:1", () => {
  const css = readCss();
  const beforeRm = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(beforeRm, /\[data-floating-state="visible"\][\s\S]*?opacity:\s*1\s*!/);
  assert.match(beforeRm, /\[data-floating-state="entering"\][\s\S]*?opacity:\s*1\s*!/);
});

test("entering state disables pointer events", () => {
  const css = readCss();
  const beforeRm = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
  // The entering-specific pointer-events rule
  const enteringSection = beforeRm.slice(beforeRm.lastIndexOf('[data-floating-state="entering"]'));
  assert.match(enteringSection, /pointer-events:\s*none\s*!/);
});

// --- Directional motion contract ---

test("top chrome variants use --floating-chrome-top-exit-y for directional exit", () => {
  const css = readCss();
  assert.match(
    css,
    /\.lian-floating-chrome--top[\s\S]*?--chrome-exit-y:\s*var\(--floating-chrome-top-exit-y\)/,
  );
});

test("bottom chrome variants use --floating-chrome-bottom-exit-y for directional exit", () => {
  const css = readCss();
  assert.match(
    css,
    /\.lian-floating-chrome--bottom[\s\S]*?--chrome-exit-y:\s*var\(--floating-chrome-bottom-exit-y\)/,
  );
});

test("hidden/exiting states use --chrome-exit-y for directional translate", () => {
  const css = readCss();
  const beforeRm = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(
    beforeRm,
    /\[data-floating-state="hidden"\][\s\S]*?translate3d\(0,\s*var\(--chrome-exit-y/,
  );
});

test("visible/entering states use translate3d(0, 0, 0) with no directional offset", () => {
  const css = readCss();
  const beforeRm = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(beforeRm, /\[data-floating-state="visible"\][\s\S]*?translate3d\(0,\s*0,\s*0\)/);
});

// --- Motion token contract ---

test("base transition references --floating-chrome-motion-duration token", () => {
  const css = readCss();
  assert.match(css, /transition:[\s\S]*?var\(--floating-chrome-motion-duration\)/);
});

test("base transition references --motion-ease-standard easing", () => {
  const css = readCss();
  assert.match(css, /transition:[\s\S]*?var\(--motion-ease-standard\)/);
});

test("--floating-chrome-motion-duration defaults to --motion-fast token", () => {
  const css = readCss();
  assert.match(css, /--floating-chrome-motion-duration:\s*var\(--motion-fast\)/);
});

// --- Glass stability contract ---

test("motion selectors do not add filter or scale transforms", () => {
  const css = readCss();
  const beforeRm = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
  // Motion section starts after the base layout rules
  const motionSection = beforeRm.slice(beforeRm.indexOf("/* Floating chrome visual motion"));
  // No filter property in motion selectors (backdrop-filter on base is fine)
  assert.doesNotMatch(motionSection, /\bfilter:/);
  // No scale() in motion selectors
  assert.doesNotMatch(motionSection, /transform:[\s\S]*?scale\(/);
});
