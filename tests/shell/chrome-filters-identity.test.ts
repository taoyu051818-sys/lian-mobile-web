import { describe, it, expect, beforeEach } from "vitest";
import { useShellChrome } from "../../src/shell/useShellChrome";

describe("shell chrome filters and identity", () => {
  let chrome: ReturnType<typeof useShellChrome>;

  beforeEach(() => {
    chrome = useShellChrome();
    chrome.resetRegions();
  });

  describe("filters", () => {
    it("sets filter toggle buttons", () => {
      chrome.setRegion("top", {
        filters: [
          { id: "food", label: "美食", active: false },
          { id: "study", label: "学习", active: true },
        ],
      });
      expect(chrome.state.top.filters).toHaveLength(2);
      expect(chrome.state.top.filters![0].id).toBe("food");
      expect(chrome.state.top.filters![0].active).toBe(false);
      expect(chrome.state.top.filters![1].active).toBe(true);
    });

    it("sets onFilterToggle callback", () => {
      const handler = (_id: string) => {};
      chrome.setRegion("top", { onFilterToggle: handler });
      expect(chrome.state.top.onFilterToggle).toBe(handler);
    });

    it("clears filters with empty array", () => {
      chrome.setRegion("top", {
        filters: [{ id: "a", label: "A", active: false }],
      });
      expect(chrome.state.top.filters).toHaveLength(1);
      chrome.setRegion("top", { filters: [] });
      expect(chrome.state.top.filters).toEqual([]);
    });

    it("clears onFilterToggle with null", () => {
      chrome.setRegion("top", { onFilterToggle: () => {} });
      expect(chrome.state.top.onFilterToggle).toBeDefined();
      chrome.setRegion("top", { onFilterToggle: null });
      expect(chrome.state.top.onFilterToggle).toBeNull();
    });

    it("preserves filters across partial patches", () => {
      chrome.setRegion("top", {
        filters: [{ id: "a", label: "A", active: true }],
        onFilterToggle: () => {},
      });
      chrome.setRegion("top", { visible: false });
      expect(chrome.state.top.filters).toHaveLength(1);
      expect(chrome.state.top.onFilterToggle).toBeDefined();
    });
  });

  describe("identity", () => {
    it("sets identity display", () => {
      chrome.setRegion("top", {
        identity: { avatarText: "小明", name: "小明同学", meta: "计算机学院" },
      });
      expect(chrome.state.top.identity).toBeDefined();
      expect(chrome.state.top.identity!.avatarText).toBe("小明");
      expect(chrome.state.top.identity!.name).toBe("小明同学");
      expect(chrome.state.top.identity!.meta).toBe("计算机学院");
    });

    it("supports identity without meta", () => {
      chrome.setRegion("top", {
        identity: { avatarText: "AB", name: "AB同学" },
      });
      expect(chrome.state.top.identity!.meta).toBeUndefined();
    });

    it("clears identity with null", () => {
      chrome.setRegion("top", {
        identity: { avatarText: "X", name: "X" },
      });
      expect(chrome.state.top.identity).toBeDefined();
      chrome.setRegion("top", { identity: null });
      expect(chrome.state.top.identity).toBeNull();
    });

    it("preserves identity across partial patches", () => {
      chrome.setRegion("top", {
        identity: { avatarText: "Y", name: "Y同学" },
      });
      chrome.setRegion("top", { visible: false });
      expect(chrome.state.top.identity).toBeDefined();
      expect(chrome.state.top.identity!.name).toBe("Y同学");
    });
  });

  describe("reset", () => {
    it("clears filters and identity on reset", () => {
      chrome.setRegion("top", {
        filters: [{ id: "a", label: "A", active: true }],
        identity: { avatarText: "Z", name: "Z" },
        onFilterToggle: () => {},
      });
      chrome.resetRegions();
      expect(chrome.state.top.filters).toEqual([]);
      expect(chrome.state.top.identity).toBeNull();
    });
  });
});
