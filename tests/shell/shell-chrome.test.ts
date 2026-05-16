import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmptyRegionSpec,
  createDefaultChromeState,
  type ShellChromeRegionSpec,
  type ChromeTabSpec,
} from "../../src/shell/shell-chrome-types";
import { useShellChrome } from "../../src/shell/useShellChrome";
import { useActiveView } from "../../src/app/useActiveView";
import { getShellLayoutMode } from "../../src/app/view-types";

describe("shell-chrome-types", () => {
  describe("createEmptyRegionSpec", () => {
    it("returns a spec with empty buttons and visible true", () => {
      const spec = createEmptyRegionSpec();
      expect(spec.buttons).toEqual([]);
      expect(spec.visible).toBe(true);
    });
  });

  describe("createDefaultChromeState", () => {
    it("returns top and bottom regions with defaults", () => {
      const state = createDefaultChromeState();
      expect(state.top.visible).toBe(true);
      expect(state.top.buttons).toEqual([]);
      expect(state.bottom.visible).toBe(true);
      expect(state.bottom.buttons).toEqual([]);
    });
  });
});

describe("useShellChrome", () => {
  let chrome: ReturnType<typeof useShellChrome>;

  beforeEach(() => {
    chrome = useShellChrome();
    chrome.resetRegions();
  });

  it("exposes readonly state with top and bottom regions", () => {
    expect(chrome.state.top).toBeDefined();
    expect(chrome.state.bottom).toBeDefined();
    expect(chrome.state.top.visible).toBe(true);
    expect(chrome.state.bottom.visible).toBe(true);
  });

  describe("setRegion", () => {
    it("patches a single region", () => {
      const spec: ShellChromeRegionSpec = {
        buttons: [{ id: "back", label: "返回" }],
        visible: true,
      };
      chrome.setRegion("top", spec);
      expect(chrome.state.top.buttons).toHaveLength(1);
      expect(chrome.state.top.buttons![0].id).toBe("back");
    });

    it("does not affect the other region", () => {
      chrome.setRegion("top", { visible: false });
      expect(chrome.state.bottom.visible).toBe(true);
    });

    it("merges partial patches", () => {
      chrome.setRegion("top", { buttons: [{ id: "a", label: "A" }] });
      chrome.setRegion("top", { visible: false });
      expect(chrome.state.top.buttons).toHaveLength(1);
      expect(chrome.state.top.visible).toBe(false);
    });

    it("supports slot field for bottom-tabs mode", () => {
      chrome.setRegion("bottom", { slot: "tabs" });
      expect(chrome.state.bottom.slot).toBe("tabs");

      chrome.setRegion("bottom", { visible: false });
      expect(chrome.state.bottom.slot).toBe("tabs");
      expect(chrome.state.bottom.visible).toBe(false);
    });

    it("supports typed tabs spec", () => {
      const tabs: ChromeTabSpec = {
        kind: "tabs",
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        activeKey: "a",
        ariaLabel: "分类",
      };
      chrome.setRegion("top", { tabs });
      expect(chrome.state.top.tabs).toBeDefined();
      expect(chrome.state.top.tabs!.kind).toBe("tabs");
      expect(chrome.state.top.tabs!.items).toHaveLength(2);
      expect(chrome.state.top.tabs!.activeKey).toBe("a");
      expect(chrome.state.top.tabs!.ariaLabel).toBe("分类");
    });

    it("supports onTabSelect callback", () => {
      const handler = (_tabId: string) => {};
      chrome.setRegion("top", { onTabSelect: handler });
      expect(chrome.state.top.onTabSelect).toBe(handler);
    });

    it("clears tabs with null", () => {
      chrome.setRegion("top", {
        tabs: { kind: "tabs", items: [{ id: "x", label: "X" }], activeKey: "x" },
      });
      expect(chrome.state.top.tabs).toBeDefined();
      chrome.setRegion("top", { tabs: null });
      expect(chrome.state.top.tabs).toBeNull();
    });

    it("clears onTabSelect with null", () => {
      chrome.setRegion("top", { onTabSelect: () => {} });
      expect(chrome.state.top.onTabSelect).toBeDefined();
      chrome.setRegion("top", { onTabSelect: null });
      expect(chrome.state.top.onTabSelect).toBeNull();
    });

    it("preserves tabs across partial patches", () => {
      chrome.setRegion("top", {
        tabs: { kind: "tabs", items: [{ id: "a", label: "A" }], activeKey: "a" },
        onTabSelect: () => {},
      });
      chrome.setRegion("top", { visible: false });
      expect(chrome.state.top.tabs).toBeDefined();
      expect(chrome.state.top.onTabSelect).toBeDefined();
      expect(chrome.state.top.visible).toBe(false);
    });
  });

  describe("applyRegions", () => {
    it("patches multiple regions at once", () => {
      chrome.applyRegions({
        top: { visible: false },
        bottom: { buttons: [{ id: "send", label: "发送", variant: "primary" }] },
      });
      expect(chrome.state.top.visible).toBe(false);
      expect(chrome.state.bottom.buttons).toHaveLength(1);
      expect(chrome.state.bottom.buttons![0].variant).toBe("primary");
    });

    it("ignores undefined region keys", () => {
      chrome.setRegion("top", { buttons: [{ id: "x", label: "X" }] });
      chrome.applyRegions({ bottom: { visible: false } });
      expect(chrome.state.top.buttons).toHaveLength(1);
    });

    it("switches top specs without disturbing bottom tab buttons", () => {
      const tabButtons = [
        { id: "feed", label: "首页" },
        { id: "messages", label: "消息" },
      ];

      chrome.applyRegions({
        top: { buttons: [{ id: "title", label: "动态" }], visible: true },
        bottom: { buttons: tabButtons, visible: true },
      });

      chrome.applyRegions({
        top: { buttons: [{ id: "back", label: "返回" }], visible: true, slot: "detail-topbar" },
      });

      expect(chrome.state.bottom.buttons).toEqual(tabButtons);
      expect(chrome.state.bottom.visible).toBe(true);
      expect(chrome.state.top.buttons).toEqual([{ id: "back", label: "返回" }]);
      expect(chrome.state.top.slot).toBe("detail-topbar");
    });
  });

  describe("resetRegions", () => {
    it("restores both regions to defaults", () => {
      chrome.setRegion("top", { visible: false, buttons: [{ id: "a", label: "A" }] });
      chrome.setRegion("bottom", { visible: false });
      chrome.resetRegions();
      expect(chrome.state.top.visible).toBe(true);
      expect(chrome.state.top.buttons).toEqual([]);
      expect(chrome.state.bottom.visible).toBe(true);
    });
  });
});

describe("shell chrome and active view state", () => {
  beforeEach(() => {
    useShellChrome().resetRegions();
    useActiveView().setActiveView("feed");
  });

  it("keeps the active tab when shell specs switch", () => {
    const chrome = useShellChrome();
    const { activeViewKey, setActiveView } = useActiveView();

    setActiveView("messages");
    chrome.applyRegions({
      top: { buttons: [{ id: "messages-title", label: "消息" }], visible: true },
      bottom: { buttons: [{ id: "messages", label: "消息" }], visible: true },
    });

    chrome.applyRegions({
      top: {
        buttons: [{ id: "detail-back", label: "返回" }],
        visible: true,
        slot: "detail-topbar",
      },
      bottom: { visible: false },
    });

    expect(activeViewKey.value).toBe("messages");
    expect(getShellLayoutMode(activeViewKey.value)).toBe("composer-safe");

    chrome.applyRegions({
      top: { buttons: [{ id: "feed-title", label: "首页" }], visible: true },
      bottom: { visible: true },
    });

    expect(activeViewKey.value).toBe("messages");
    expect(chrome.state.bottom.visible).toBe(true);
  });
});
