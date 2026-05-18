import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("PostReplyDock layout under chrome slot protocol (#130 / dock-in-shell)", () => {
  const dockSource = readRepoFile("../../src/features/detail/PostReplyDock.vue");

  it("does not self-position via lian-floating-chrome (shell bottom slot owns position)", () => {
    expect(dockSource).not.toContain("lian-floating-chrome");
    expect(dockSource).not.toMatch(/\bbottom:\s*calc\(/);
  });

  it("does not consume --keyboard-inset-bottom directly (shell container does)", () => {
    expect(dockSource).not.toContain("--keyboard-inset-bottom");
  });

  it("preserves reduced-motion by disabling internal transitions", () => {
    expect(dockSource).toContain("prefers-reduced-motion: reduce");
    expect(dockSource).toMatch(/prefers-reduced-motion:[\s\S]*transition:\s*none/);
  });

  it("does not import useVisualViewport (consumed by parent panel)", () => {
    expect(dockSource).not.toContain("useVisualViewport");
  });
});

describe("Shell bottom slot owns keyboard inset (#130 / dock-in-shell)", () => {
  it("--keyboard-inset-bottom is defined in lian-tokens", () => {
    const tokensSource = readRepoFile("../../src/styles/lian-tokens.css");
    expect(tokensSource).toContain("--keyboard-inset-bottom");
  });

  it("lian-floating-chrome--bottom consumes --keyboard-inset-bottom", () => {
    const chromeSource = readRepoFile("../../src/styles/chrome-surface.css");
    expect(chromeSource).toMatch(
      /lian-floating-chrome--bottom\s*\{[\s\S]*var\(--keyboard-inset-bottom/,
    );
  });
});

describe("PostDetailPanel keyboard-inset activation (#130)", () => {
  const panelSource = readRepoFile("../../src/features/detail/PostDetailPanel.vue");

  it("imports useVisualViewport from the composables directory", () => {
    expect(panelSource).toContain('from "../../composables/useVisualViewport"');
  });

  it("calls useVisualViewport() to activate keyboard tracking", () => {
    expect(panelSource).toMatch(/useVisualViewport\(\s*\)/);
  });

  it("calls useVisualViewport before reply composable setup", () => {
    const viewportPos = panelSource.indexOf("useVisualViewport()");
    const replyComposablePos = panelSource.indexOf("usePostReplyComposer(");
    expect(viewportPos).toBeGreaterThan(-1);
    expect(replyComposablePos).toBeGreaterThan(-1);
    expect(viewportPos).toBeLessThan(replyComposablePos);
  });
});

describe("floating-chrome bottom baseline (#130)", () => {
  const chromeSource = readRepoFile("../../src/styles/floating-chrome.css");

  it("reduced-motion override disables transitions on bottom floating chrome", () => {
    expect(chromeSource).toMatch(
      /prefers-reduced-motion[\s\S]*post-detail-panel__dock[\s\S]*transition:\s*none/,
    );
  });
});
