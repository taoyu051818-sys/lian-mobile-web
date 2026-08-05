import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Apple Music gap PR-α — motion token vocabulary contract.
 *
 * Background: Apple Music Web ships 4 ease curves + 1 transition shorthand;
 * LIAN previously had only `--motion-ease-standard`. This contract locks in
 * the vocabulary so future Apple-gap PRs (γ etc.) can rely on these names.
 *
 * Scope:
 * - Token names exist in `:root` of src/styles/lian-tokens.css.
 * - The active base components (LianButton and ToastHost) reference at least
 *   one of the new ease tokens or the shorthand, so the vocabulary is
 *   actually wired into product surfaces (not just declared).
 * - Existing `--motion-ease-standard` is preserved (no value drift).
 */

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

const tokensCss = readRepoFile("../../src/styles/lian-tokens.css");

describe("motion token vocabulary (Apple Music gap PR-α)", () => {
  it("preserves the existing --motion-ease-standard cubic-bezier value", () => {
    expect(tokensCss).toMatch(
      /--motion-ease-standard:\s*cubic-bezier\(0\.22,\s*0\.61,\s*0\.36,\s*1\)/,
    );
  });

  it("declares --motion-ease-decelerate for retreating / fade-out motion", () => {
    expect(tokensCss).toMatch(/--motion-ease-decelerate:\s*cubic-bezier\(/);
  });

  it("declares --motion-ease-emphasized for important state transitions", () => {
    expect(tokensCss).toMatch(/--motion-ease-emphasized:\s*cubic-bezier\(/);
  });

  it("declares --motion-ease-overshoot for spring-style landings", () => {
    expect(tokensCss).toMatch(/--motion-ease-overshoot:\s*cubic-bezier\(/);
  });

  it("declares the --motion-transition shorthand defaulting to opacity (not all)", () => {
    // opacity-only default mirrors Apple Music: avoids layout-affecting transitions
    // sneaking in via `transition: var(--motion-transition)` on every base.
    const match = tokensCss.match(/--motion-transition:\s*([^;]+);/);
    expect(match, "--motion-transition shorthand declaration").not.toBeNull();
    const value = match![1];
    expect(value).toMatch(/^\s*opacity\s+/);
    expect(value).toMatch(/var\(--motion-fast\)/);
    expect(value).toMatch(/var\(--motion-ease-standard\)/);
    expect(value).not.toMatch(/\ball\b/);
  });

  it("declares all 4 ease curves and the shorthand inside :root", () => {
    const rootStart = tokensCss.indexOf(":root");
    const rootEnd = tokensCss.indexOf("}", rootStart);
    expect(rootStart).toBeGreaterThanOrEqual(0);
    const rootBlock = tokensCss.slice(rootStart, rootEnd);
    for (const name of [
      "--motion-ease-standard",
      "--motion-ease-decelerate",
      "--motion-ease-emphasized",
      "--motion-ease-overshoot",
      "--motion-transition",
    ]) {
      expect(rootBlock, `${name} should live in :root`).toContain(name);
    }
  });
});

describe("motion vocab is wired into base components (not just declared)", () => {
  it("LianButton.vue transitions background-color/opacity/transform with motion tokens", () => {
    const src = readRepoFile("../../src/ui/LianButton.vue");
    expect(src).toMatch(/transition:\s*[\s\S]*background-color\s+var\(--motion-fast\)/);
    expect(src).toMatch(/var\(--motion-ease-standard\)/);
    expect(src).toMatch(/transform\s+var\(--motion-micro\)/);
  });

  it("ToastHost.vue uses --motion-ease-overshoot on enter and decelerate on leave", () => {
    const src = readRepoFile("../../src/ui/feedback/ToastHost.vue");
    expect(src).toContain("--motion-ease-overshoot");
    expect(src).toContain("--motion-ease-decelerate");
    expect(src).toMatch(/lian-toast-enter-active/);
    expect(src).toMatch(/lian-toast-leave-active/);
  });

  it("base components honour prefers-reduced-motion (transition: none guard)", () => {
    const src = readRepoFile("../../src/ui/feedback/ToastHost.vue");
    expect(src).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(src).toMatch(/transition:\s*none/);
  });
});
