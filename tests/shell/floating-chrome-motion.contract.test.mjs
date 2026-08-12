import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const reducedMotionMarker = "@media (prefers-reduced-motion: reduce)";

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n?/g, "\n");
}

function ruleBody(source, selectorPattern) {
  const match = source.match(new RegExp(`${selectorPattern}\\s*\\{([^{}]*)\\}`));
  assert.ok(match, `missing CSS rule matching ${selectorPattern}`);
  return match[1];
}

const floatingCss = read("src/styles/floating-chrome.css");
const chromeSurfaceCss = read("src/styles/chrome-surface.css");
const shellCss = read("src/shell/shell-chrome.css");
const shellComponent = read("src/shell/ShellChrome.vue");
const floatingState = read("src/shell/floatingChromeState.ts");
const detailSurface = read("src/app/DetailSurface.vue");

// --- Reduced-motion contract ---

test("floating chrome reduced-motion override neutralizes traversal and visual effects", () => {
  assert.match(floatingCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  const reducedMotion = floatingCss.slice(floatingCss.indexOf(reducedMotionMarker));
  const body = ruleBody(
    reducedMotion,
    "\\.lian-floating-chrome\\s*,[\\s\\S]*?\\.vue-shell__bottom-tab\\.lian-floating-chrome",
  );

  assert.match(body, /transition:\s*none\s*!important/);
  assert.match(body, /transform:\s*none\s*!important/);
  assert.match(body, /filter:\s*none\s*!important/);
});

test("shell tab and coordinated slot transitions are disabled for reduced motion", () => {
  const firstReducedMotion = shellCss.indexOf(reducedMotionMarker);
  const lastReducedMotion = shellCss.lastIndexOf(reducedMotionMarker);
  assert.ok(firstReducedMotion >= 0 && lastReducedMotion > firstReducedMotion);

  const tabReducedMotion = shellCss.slice(firstReducedMotion, lastReducedMotion);
  assert.match(ruleBody(tabReducedMotion, "\\.shell-chrome__tab"), /transition:\s*none/);

  const slotReducedMotion = shellCss.slice(lastReducedMotion);
  const activeBody = ruleBody(
    slotReducedMotion,
    "\\.shell-slot-top-enter-active\\s*,[\\s\\S]*?\\.shell-slot-bottom-leave-active",
  );
  const traversalBody = ruleBody(
    slotReducedMotion,
    "\\.shell-slot-top-enter-from\\s*,[\\s\\S]*?\\.shell-slot-bottom-leave-to",
  );
  assert.match(activeBody, /transition:\s*none/);
  assert.match(traversalBody, /transform:\s*none/);
  assert.match(traversalBody, /opacity:\s*1/);
  assert.match(traversalBody, /filter:\s*none/);
});

// --- Declarative visibility and phase ownership ---

test("ShellChrome exposes declarative visibility without legacy lifecycle attributes", () => {
  assert.match(shellComponent, /:data-visible="isVisible"/);
  for (const source of [shellComponent, shellCss, floatingCss]) {
    assert.doesNotMatch(source, /data-floating-state/);
  }
});

test("hidden shell chrome is visually hidden and cannot receive pointer events", () => {
  const hiddenBody = ruleBody(shellCss, '\\.shell-chrome\\[data-visible="false"\\]');
  const childBody = ruleBody(
    shellCss,
    '\\.shell-chrome\\[data-visible="false"\\]\\s+\\.lian-floating-chrome',
  );
  assert.match(hiddenBody, /opacity:\s*0/);
  assert.match(hiddenBody, /pointer-events:\s*none/);
  assert.match(childBody, /pointer-events:\s*none/);
});

test("DetailSurface drives the shared phase and idle is the only shell-visible phase", () => {
  assert.match(
    floatingState,
    /shellVisible\s*=\s*computed\(\s*\(\)\s*=>\s*state\.detailPhase\s*===\s*"idle"\s*\)/,
  );
  assert.match(
    floatingState,
    /export type ChromePhase\s*=\s*"idle"\s*\|\s*"opening"\s*\|\s*"open"\s*\|\s*"dragging"\s*\|\s*"returning"/,
  );
  assert.match(detailSurface, /setDetailPhase\(\s*open\s*\?\s*"open"\s*:\s*"idle"\s*\)/);
});

// --- Surface, positioning, and motion-token ownership ---

test("chrome-surface.css owns the fixed safe-area-aware glass base", () => {
  const body = ruleBody(chromeSurfaceCss, "\\.chrome-surface\\s*,\\s*\\.lian-floating-chrome");
  assert.match(body, /position:\s*fixed/);
  assert.match(body, /right:\s*max\([^;]*env\(safe-area-inset-right\)/);
  assert.match(body, /left:\s*max\([^;]*env\(safe-area-inset-left\)/);
  assert.match(body, /background:\s*var\(--glass-bg-strong\)/);
  assert.match(body, /box-shadow:\s*var\(--shadow-floating\)/);
  assert.match(body, /backdrop-filter:\s*blur\(var\(--glass-blur\)\)/);
});

test("top and bottom surface variants consume their positioning tokens", () => {
  const topBody = ruleBody(
    chromeSurfaceCss,
    "\\.chrome-surface--top\\s*,\\s*\\.lian-floating-chrome--top",
  );
  const bottomBody = ruleBody(
    chromeSurfaceCss,
    "\\.chrome-surface--bottom\\s*,\\s*\\.lian-floating-chrome--bottom",
  );
  assert.match(topBody, /top:\s*var\(--floating-bar-top-offset\)/);
  assert.match(bottomBody, /bottom:\s*calc\([^;]*--floating-bar-bottom-offset/);
  assert.match(bottomBody, /var\(--keyboard-inset-bottom,\s*0px\)/);
});

test("regular shell chrome motion uses shared duration and easing tokens", () => {
  const body = ruleBody(shellCss, "\\.shell-chrome__inner\\.lian-floating-chrome");
  assert.match(
    body,
    /transition:\s*transform\s+var\(--motion-standard\)\s+var\(--motion-ease-standard\)/,
  );
});

test("slot enter and leave motion coordinates transform, opacity, and filter with shared tokens", () => {
  const body = ruleBody(
    shellCss,
    "\\.shell-slot-top-enter-active\\s*,[\\s\\S]*?\\.shell-slot-bottom-leave-active",
  );
  for (const property of ["transform", "opacity", "filter"]) {
    assert.match(
      body,
      new RegExp(`${property}\\s+var\\(--motion-standard\\)\\s+var\\(--motion-ease-standard\\)`),
    );
  }
});

test("top and bottom slot motion enters from the matching viewport edge", () => {
  const topBody = ruleBody(
    shellCss,
    "\\.shell-slot-top-enter-from\\s*,\\s*\\.shell-slot-top-leave-to",
  );
  const bottomBody = ruleBody(
    shellCss,
    "\\.shell-slot-bottom-enter-from\\s*,\\s*\\.shell-slot-bottom-leave-to",
  );
  assert.match(topBody, /translateY\(-[^)]+\)/);
  assert.match(bottomBody, /translateY\((?!-)[^)]+\)/);
});

test("floating chrome transitions do not introduce hard-coded timing", () => {
  for (const [name, source] of [
    ["floating-chrome.css", floatingCss],
    ["shell-chrome.css", shellCss],
  ]) {
    const offenders = [];
    const declaration = /transition(?:-duration)?:\s*([^;}]+)[;}]/g;
    let match;
    while ((match = declaration.exec(source)) !== null) {
      const value = match[1].trim();
      if (/^none(?:\s*!important)?$/.test(value)) continue;
      if (/\b\d+(?:\.\d+)?(?:ms|s)\b/.test(value)) offenders.push(value);
    }
    assert.deepEqual(offenders, [], `hard-coded transition timing in ${name}`);
  }
});
