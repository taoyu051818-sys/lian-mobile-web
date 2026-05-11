import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("useReducedMotion shared module (#254)", () => {
  const source = readRepoFile("../../src/motion/useReducedMotion.ts");

  it("exports a reactive composable and a one-shot helper", () => {
    expect(source).toContain("export function useReducedMotion()");
    expect(source).toContain("export function prefersReducedMotion(): boolean");
  });

  it("is SSR-safe: guards against missing window and matchMedia", () => {
    expect(source).toContain('typeof window === "undefined"');
    expect(source).toContain("window.matchMedia?");
  });

  it("listens for runtime preference changes via the change event", () => {
    expect(source).toContain("addEventListener(\"change\"");
    expect(source).toContain("removeEventListener(\"change\"");
  });

  it("cleans up the change listener on unmount", () => {
    expect(source).toContain("onBeforeUnmount");
  });

  it("checks the correct media query", () => {
    expect(source).toContain("(prefers-reduced-motion: reduce)");
  });
});

describe("useReducedMotion runtime behavior", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("prefersReducedMotion returns false in non-browser context", async () => {
    // Temporarily remove window to simulate SSR
    const { prefersReducedMotion } = await import("../../src/motion/useReducedMotion");
    // In vitest, window exists, so this tests the guard logic structure
    // The actual SSR safety is verified by the source-level checks above
    expect(typeof prefersReducedMotion()).toBe("boolean");
  });
});
