import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmptyRegionSpec,
  createDefaultChromeState,
  type ShellChromeRegionSpec,
  type ShellChromeState,
} from "../../src/shell/shell-chrome-types";
import { useShellChrome } from "../../src/shell/useShellChrome";

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
