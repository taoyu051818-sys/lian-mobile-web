import { describe, it, expect, beforeEach } from "vitest";
import { useShellChrome } from "../../src/shell/useShellChrome";

/**
 * Verifies the chrome spec declarations that ProfileView applies
 * via useShellChrome when the user state changes.
 *
 * ProfileView calls setRegion("top", ...) / resetRegions() — these
 * tests exercise that same logic in isolation.
 */
describe("profile chrome spec", () => {
  let chrome: ReturnType<typeof useShellChrome>;

  beforeEach(() => {
    chrome = useShellChrome();
    chrome.resetRegions();
  });

  function applyAuthenticatedSpec(editorOpen: boolean) {
    chrome.setRegion("top", {
      visible: true,
      slot: "tabs",
      buttons: [
        {
          id: "profile:toggle-editor",
          label: editorOpen ? "收起编辑" : "编辑资料",
          variant: "tonal",
        },
        { id: "profile:logout", label: "退出登录", variant: "ghost" },
      ],
    });
  }

  it("sets top chrome with action buttons and tabs slot for authenticated user", () => {
    applyAuthenticatedSpec(false);

    expect(chrome.state.top.visible).toBe(true);
    expect(chrome.state.top.slot).toBe("tabs");
    expect(chrome.state.top.buttons).toHaveLength(2);
    expect(chrome.state.top.buttons![0].id).toBe("profile:toggle-editor");
    expect(chrome.state.top.buttons![0].label).toBe("编辑资料");
    expect(chrome.state.top.buttons![0].variant).toBe("tonal");
    expect(chrome.state.top.buttons![1].id).toBe("profile:logout");
    expect(chrome.state.top.buttons![1].label).toBe("退出登录");
    expect(chrome.state.top.buttons![1].variant).toBe("ghost");
  });

  it("toggles editor button label when editorOpen changes", () => {
    applyAuthenticatedSpec(false);
    expect(chrome.state.top.buttons![0].label).toBe("编辑资料");

    applyAuthenticatedSpec(true);
    expect(chrome.state.top.buttons![0].label).toBe("收起编辑");
  });

  it("resets chrome when user enters guest state", () => {
    applyAuthenticatedSpec(false);
    expect(chrome.state.top.buttons).toHaveLength(2);

    chrome.resetRegions();
    expect(chrome.state.top.buttons).toEqual([]);
    expect(chrome.state.top.visible).toBe(true);
  });

  it("does not disturb bottom region when setting top chrome", () => {
    chrome.setRegion("bottom", { slot: "tabs", visible: true });
    applyAuthenticatedSpec(false);

    expect(chrome.state.bottom.slot).toBe("tabs");
    expect(chrome.state.bottom.visible).toBe(true);
  });

  it("preserves bottom chrome after guest reset", () => {
    chrome.setRegion("bottom", { slot: "tabs", visible: true });
    applyAuthenticatedSpec(false);
    chrome.resetRegions();

    expect(chrome.state.bottom.visible).toBe(true);
    expect(chrome.state.bottom.slot).toBe("tabs");
    expect(chrome.state.bottom.buttons).toEqual([]);
  });
});
