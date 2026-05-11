import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractScopedStyleBlock(source) {
  const match = source.match(/<style scoped>([\s\S]*?)<\/style>/);
  assert.ok(match, "expected a <style scoped> block in FeedView.vue");
  return match[1];
}

function extractCardTransitionRules(scopedBlock) {
  const rules = [];
  let depth = 0;
  let current = "";
  for (const line of scopedBlock.split("\n")) {
    if (line.includes(".feed-view__card-transition") && !current) {
      current = line;
      depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (depth <= 0) {
        rules.push(current);
        current = "";
      }
    } else if (current) {
      current += "\n" + line;
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (depth <= 0) {
        rules.push(current);
        current = "";
      }
    }
  }
  return rules;
}

test("card-camera-transition.css is imported in main.css", () => {
  const main = read("src/styles/main.css");
  assert.ok(
    main.includes('@import "./card-camera-transition.css"'),
    "main.css must import card-camera-transition.css for global overlay ownership",
  );
});

test("card-camera-transition.css owns position:fixed for the overlay", () => {
  const css = read("src/styles/card-camera-transition.css");
  assert.ok(
    css.includes("position: fixed !important"),
    "card-camera-transition.css must own position:fixed with !important",
  );
});

test("card-camera-transition.css owns core overlay behavior with !important", () => {
  const css = read("src/styles/card-camera-transition.css");
  const requiredProps = [
    "z-index",
    "display:",
    "overflow:",
    "width:",
    "height:",
    "border-radius",
    "pointer-events:",
    "transition:",
    "will-change:",
  ];
  for (const prop of requiredProps) {
    const lines = css.split("\n");
    const hasImportantProp = lines.some(
      (line) => line.includes(prop) && line.includes("!important"),
    );
    assert.ok(
      hasImportantProp,
      `card-camera-transition.css must declare ${prop.trim()} with !important`,
    );
  }
});

test("card-camera-transition.css has reduced-motion block for overlay", () => {
  const css = read("src/styles/card-camera-transition.css");
  assert.ok(
    css.includes("@media (prefers-reduced-motion: reduce)"),
    "card-camera-transition.css must have a reduced-motion media block",
  );
  assert.ok(
    css.includes("transition: none !important"),
    "reduced-motion block must disable transitions with !important",
  );
});

test("FeedView.vue scoped CSS has no structural card-transition declarations", () => {
  const source = read("src/views/FeedView.vue");
  const scopedBlock = extractScopedStyleBlock(source);

  const forbiddenProps = [
    "position:",
    "top:",
    "left:",
    "width:",
    "height:",
    "z-index:",
    "overflow:",
    "border-radius",
    "pointer-events:",
    "box-shadow",
    "will-change",
    "transform-origin",
  ];

  const rules = extractCardTransitionRules(scopedBlock);
  for (const rule of rules) {
    if (rule.includes("@media")) continue;
    for (const prop of forbiddenProps) {
      assert.ok(
        !rule.includes(prop),
        `scoped .feed-view__card-transition rule must not declare ${prop.trim()} (owned by card-camera-transition.css)`,
      );
    }
  }
});

test("FeedView.vue still references card-transition in reduced-motion block", () => {
  const source = read("src/views/FeedView.vue");
  const scopedBlock = extractScopedStyleBlock(source);
  const rmMatch = scopedBlock.match(
    /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\s*\}/,
  );
  assert.ok(rmMatch, "FeedView.vue scoped block must have a reduced-motion media query");
  assert.ok(
    rmMatch[1].includes(".feed-view__card-transition"),
    "reduced-motion block must reference .feed-view__card-transition for transition:none",
  );
});
