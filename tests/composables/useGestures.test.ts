import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("usePullToRefresh composable", () => {
  const source = readRepoFile("../../src/composables/usePullToRefresh.ts");

  it("exports the usePullToRefresh function", () => {
    expect(source).toContain("export function usePullToRefresh");
  });

  it("exports PullToRefreshState type", () => {
    expect(source).toContain("export interface PullToRefreshState");
  });

  it("is SSR-safe: does not access window at module level", () => {
    const lines = source.split("\n");
    let inFunction = false;
    let braceCount = 0;

    for (const line of lines) {
      if (line.includes("function ") || line.includes("=> {")) {
        inFunction = true;
      }
      if (inFunction) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
        if (braceCount === 0) inFunction = false;
      }
      if (!inFunction && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        expect(line).not.toMatch(/\bwindow\b/);
      }
    }
  });

  it("uses touch events for pull detection", () => {
    expect(source).toContain("TouchEvent");
    expect(source).toContain("onTouchstart");
    expect(source).toContain("onTouchmove");
    expect(source).toContain("onTouchend");
  });

  it("provides configurable threshold and maxPull options", () => {
    expect(source).toContain("threshold");
    expect(source).toContain("maxPull");
    expect(source).toContain("DEFAULT_THRESHOLD");
    expect(source).toContain("DEFAULT_MAX_PULL");
  });

  it("implements resistance for over-pull", () => {
    expect(source).toContain("resistance");
    expect(source).toContain("DEFAULT_RESISTANCE");
  });

  it("tracks pull state (isPulling, isRefreshing, canRefresh)", () => {
    expect(source).toContain("isPulling");
    expect(source).toContain("isRefreshing");
    expect(source).toContain("canRefresh");
  });

  it("provides progress tracking (0 to 1)", () => {
    expect(source).toContain("progress");
    expect(source).toContain("Math.min");
  });

  it("uses spring animation tokens for return animation", () => {
    expect(source).toContain("--motion-return");
    expect(source).toContain("--motion-ease-overshoot");
  });

  it("integrates haptic feedback", () => {
    expect(source).toContain("hapticMedium");
  });

  it("cleans up on unmount", () => {
    expect(source).toContain("onBeforeUnmount");
  });

  it("respects reduced motion preference", () => {
    expect(source).toContain("prefersReducedMotion");
  });
});
