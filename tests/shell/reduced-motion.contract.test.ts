import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function getReducedMotionBlock(source: string) {
  const match = source.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  expect(match, "expected a reduced-motion media block").toBeTruthy();
  return match![1];
}

describe("floating chrome reduced-motion", () => {
  it("floating-chrome.css has reduced-motion block", () => {
    const source = readRepoFile("../../src/styles/floating-chrome.css");
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    const rmBlock = source.slice(source.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rmBlock).toContain("transition: none !important");
    expect(rmBlock).toContain("transform: none !important");
    expect(rmBlock).toContain("filter: none !important");
  });
});

describe("Feed detail reduced-motion guards", () => {
  const sharedSource = readRepoFile("../../src/composables/useReducedMotion.ts");
  const immersiveSource = readRepoFile("../../src/styles/content-immersive-ui.css");
  const immersiveReducedMotionBlock = getReducedMotionBlock(immersiveSource);

  it("shared module exports prefersReducedMotion with SSR-safe matchMedia check", () => {
    expect(sharedSource).toContain("export function prefersReducedMotion");
    expect(sharedSource).toContain("window.matchMedia");
    expect(sharedSource).toContain("prefers-reduced-motion: reduce");
  });

  it("disables non-essential transitions without globally disabling all animation", () => {
    expect(immersiveReducedMotionBlock).toContain(".shell-chrome__tab");
    expect(immersiveReducedMotionBlock).toContain("transition: none");
    expect(immersiveReducedMotionBlock).not.toContain("animation: none");
  });
});

describe("shell chrome tabs reduced-motion stylesheet", () => {
  it("disables tab transitions under reduced motion", () => {
    const source = readRepoFile("../../src/shell/shell-chrome.css");
    const reducedMotionBlock = getReducedMotionBlock(source);

    expect(reducedMotionBlock).toContain(".shell-chrome__tab");
    expect(reducedMotionBlock).not.toContain(".feed-view__tab");
    expect(reducedMotionBlock).toContain("transition: none");
  });
});
