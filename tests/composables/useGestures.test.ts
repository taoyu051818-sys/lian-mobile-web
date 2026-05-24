import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("useSwipeGesture composable", () => {
  const source = readRepoFile("../../src/composables/useSwipeGesture.ts");

  it("exports the useSwipeGesture function", () => {
    expect(source).toContain("export function useSwipeGesture");
  });

  it("exports SwipeDirection and SwipeGestureState types", () => {
    expect(source).toContain("export type SwipeDirection");
    expect(source).toContain("export interface SwipeGestureState");
  });

  it("is SSR-safe: does not access window at module level", () => {
    // The composable should not have top-level window access
    // All window access should be inside functions
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
      // Skip lines inside functions
      if (!inFunction && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        expect(line).not.toMatch(/\bwindow\b/);
        expect(line).not.toMatch(/\bdocument\b/);
      }
    }
  });

  it("uses touch events for gesture detection", () => {
    expect(source).toContain("TouchEvent");
    expect(source).toContain("onTouchstart");
    expect(source).toContain("onTouchmove");
    expect(source).toContain("onTouchend");
    expect(source).toContain("onTouchcancel");
  });

  it("provides configurable threshold option", () => {
    expect(source).toContain("threshold");
    expect(source).toContain("DEFAULT_THRESHOLD");
  });

  it("tracks swipe direction (left, right, up, down)", () => {
    expect(source).toContain('"left"');
    expect(source).toContain('"right"');
    expect(source).toContain('"up"');
    expect(source).toContain('"down"');
  });

  it("provides offset tracking for visual feedback", () => {
    expect(source).toContain("offsetX");
    expect(source).toContain("offsetY");
  });

  it("cleans up on unmount", () => {
    expect(source).toContain("onBeforeUnmount");
  });

  it("imports prefersReducedMotion for motion preference checking", () => {
    expect(source).toContain('import { prefersReducedMotion } from "./useReducedMotion"');
  });

  it("returns handlers object for v-bind spread", () => {
    expect(source).toContain("const handlers = {");
    expect(source).toContain("return {");
    expect(source).toContain("handlers,");
  });
});

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

describe("useLongPress composable", () => {
  const source = readRepoFile("../../src/composables/useLongPress.ts");

  it("exports the useLongPress function", () => {
    expect(source).toContain("export function useLongPress");
  });

  it("exports LongPressState type", () => {
    expect(source).toContain("export interface LongPressState");
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

  it("uses both touch and pointer events", () => {
    expect(source).toContain("TouchEvent");
    expect(source).toContain("PointerEvent");
    expect(source).toContain("onTouchstart");
    expect(source).toContain("onPointerdown");
  });

  it("provides configurable duration option", () => {
    expect(source).toContain("duration");
    expect(source).toContain("DEFAULT_DURATION");
  });

  it("provides configurable move tolerance", () => {
    expect(source).toContain("moveTolerance");
    expect(source).toContain("DEFAULT_MOVE_TOLERANCE");
  });

  it("tracks press state (isPressed, isLongPress)", () => {
    expect(source).toContain("isPressed");
    expect(source).toContain("isLongPress");
  });

  it("provides progress tracking for visual feedback", () => {
    expect(source).toContain("progress");
  });

  it("prevents default context menu on long press", () => {
    expect(source).toContain("handleContextMenu");
    expect(source).toContain("preventDefault");
  });

  it("integrates haptic feedback", () => {
    expect(source).toContain("hapticMedium");
  });

  it("cleans up timers on unmount", () => {
    expect(source).toContain("onBeforeUnmount");
    expect(source).toContain("clearTimers");
  });

  it("respects reduced motion preference", () => {
    expect(source).toContain("prefersReducedMotion");
  });
});
