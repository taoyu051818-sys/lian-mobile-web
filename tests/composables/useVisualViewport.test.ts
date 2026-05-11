import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("useVisualViewport source contract (#130)", () => {
  const source = readRepoFile("../../src/composables/useVisualViewport.ts");

  it("exports the composable function", () => {
    expect(source).toContain("export function useVisualViewport()");
  });

  it("guards against missing window (SSR)", () => {
    expect(source).toContain('typeof window === "undefined"');
  });

  it("guards against missing visualViewport API", () => {
    expect(source).toContain("window.visualViewport");
  });

  it("listens for resize and scroll events", () => {
    expect(source).toContain('addEventListener("resize"');
    expect(source).toContain('addEventListener("scroll"');
  });

  it("removes resize and scroll listeners on cleanup", () => {
    expect(source).toContain('removeEventListener("resize"');
    expect(source).toContain('removeEventListener("scroll"');
  });

  it("cleans up on unmount via onBeforeUnmount", () => {
    expect(source).toContain("onBeforeUnmount");
  });

  it("cancels pending animation frames on cleanup", () => {
    expect(source).toContain("cancelAnimationFrame");
  });

  it("sets the --keyboard-inset-bottom CSS custom property", () => {
    expect(source).toContain("--keyboard-inset-bottom");
  });

  it("removes the CSS custom property on cleanup", () => {
    expect(source).toContain("removeProperty(\"--keyboard-inset-bottom\")");
  });

  it("clamps the inset to a non-negative value", () => {
    expect(source).toMatch(/Math\.max\(\s*0/);
  });

  it("does not use UA sniffing", () => {
    expect(source).not.toContain("navigator.userAgent");
    expect(source).not.toContain("userAgent");
  });
});

describe("useVisualViewport runtime behavior (#130)", () => {
  it("returns keyboardInsetBottom ref", async () => {
    const { useVisualViewport } = await import("../../src/composables/useVisualViewport");
    const result = useVisualViewport();
    expect(result).toHaveProperty("keyboardInsetBottom");
    expect(result.keyboardInsetBottom).toHaveProperty("value");
  });
});
