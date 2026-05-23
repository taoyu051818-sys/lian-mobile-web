import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isRef } from "vue";

/**
 * Phase 1.5 SSR contract for `useReducedMotion`
 * (RFC §6 — `docs/architecture/SSR_PWA_RFC_2026_05_23.md`).
 *
 * `useReducedMotion()` is invoked as part of the `/post/:tid` and `/`
 * render trees in phase 1. The Node SSR path has no `window`, so:
 *
 *   1. Importing the module must not throw.
 *   2. Calling the factory with `window` deleted must not throw and must
 *      return a ref-shaped value defaulting to `reduced.value === false`.
 *      This default keeps SSR HTML aligned with the client first paint and
 *      avoids hydration mismatch on classes that key off `reduced`.
 *
 * Client-side listener / matchMedia behavior is covered by existing suites
 * (`tests/motion/useReducedMotion.test.ts`,
 * `tests/motion/reduced-motion-regression.structure.test.mjs`) — this file
 * is intentionally narrow to the SSR boundary.
 */
describe("useReducedMotion SSR safety (RFC phase 1.5)", () => {
  let savedWindow: typeof globalThis.window | undefined;
  let hadWindow = false;

  beforeEach(() => {
    hadWindow = "window" in globalThis;
    if (hadWindow) {
      savedWindow = (globalThis as { window?: typeof globalThis.window }).window;
    }
    delete (globalThis as { window?: typeof globalThis.window }).window;
  });

  afterEach(() => {
    if (hadWindow) {
      (globalThis as { window?: typeof globalThis.window }).window = savedWindow;
    } else {
      delete (globalThis as { window?: typeof globalThis.window }).window;
    }
  });

  it("imports without referencing window at module top-level", async () => {
    // Re-import under the deleted-window environment. Vitest module cache
    // means a previous import in another test file may have already
    // evaluated this module — but since the contract is "module top-level
    // does not touch window", a fresh evaluation under SSR conditions must
    // also succeed.
    await expect(import("../../src/composables/useReducedMotion")).resolves.toBeTruthy();
  });

  it("returns a ref defaulting to reduced.value === false when window is absent", async () => {
    const { useReducedMotion } = await import("../../src/composables/useReducedMotion");

    // The factory must short-circuit before `onMounted` registration. We
    // call it outside a Vue component instance — if it tried to register
    // lifecycle hooks unconditionally, vue would warn or throw. The
    // typeof-window guard keeps us off that path on the SSR side.
    let result: ReturnType<typeof useReducedMotion> | undefined;
    expect(() => {
      result = useReducedMotion();
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(isRef(result!)).toBe(true);
    expect(result!.value).toBe(false);
  });
});
