import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("PostReplyDock keyboard-inset wiring (#130)", () => {
  const dockSource = readRepoFile("../../src/features/detail/PostReplyDock.vue");

  it("consumes --keyboard-inset-bottom in the bottom offset", () => {
    expect(dockSource).toContain("--keyboard-inset-bottom");
  });

  it("falls back to 0px when the keyboard token is absent", () => {
    expect(dockSource).toContain("var(--keyboard-inset-bottom, 0px)");
  });

  it("includes bottom in the transition list for smooth keyboard animation", () => {
    expect(dockSource).toMatch(/transition:[\s\S]*bottom\s+\d+ms/);
  });

  it("preserves reduced-motion by disabling all transitions", () => {
    expect(dockSource).toContain("prefers-reduced-motion: reduce");
    expect(dockSource).toMatch(/prefers-reduced-motion:[\s\S]*transition:\s*none/);
  });

  it("uses the detail-reply-dock-bottom-offset token for independent positioning", () => {
    expect(dockSource).toContain("--detail-reply-dock-bottom-offset");
  });

  it("detail-reply-dock-bottom-offset is defined in lian-tokens", () => {
    const tokensSource = readRepoFile("../../src/styles/lian-tokens.css");
    expect(tokensSource).toContain("--detail-reply-dock-bottom-offset");
  });

  it("does not import useVisualViewport (consumed by parent panel)", () => {
    expect(dockSource).not.toContain("useVisualViewport");
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

  it("defines --keyboard-inset-bottom as a default token in lian-tokens", () => {
    const tokensSource = readRepoFile("../../src/styles/lian-tokens.css");
    expect(tokensSource).toContain("--keyboard-inset-bottom");
  });

  it("reduced-motion override disables transitions on bottom floating chrome", () => {
    expect(chromeSource).toMatch(
      /prefers-reduced-motion[\s\S]*post-detail-panel__dock[\s\S]*transition:\s*none/,
    );
  });
});
