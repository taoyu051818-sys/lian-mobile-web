import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubGlobal("document", { querySelector: vi.fn(() => null) });
vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} });

const setRegion = vi.fn();
const resetRegions = vi.fn();

vi.mock("../../src/shell/useShellChrome", () => ({
  useShellChrome: () => ({ setRegion, resetRegions, state: { top: {}, bottom: {} } }),
}));

import { usePublishChromeActions } from "../../src/views/publish/usePublishChromeActions";

describe("usePublishChromeActions", () => {
  beforeEach(() => {
    setRegion.mockClear();
    resetRegions.mockClear();
  });

  it("setup calls setRegion with clear and submit button specs", () => {
    const actions = usePublishChromeActions({ onPublish: vi.fn(), onClear: vi.fn() });
    actions.setup();
    expect(setRegion).toHaveBeenCalledWith("bottom", {
      buttons: [
        { id: "publish-clear", label: "清空", variant: "ghost" },
        { id: "publish-submit", label: "发布", variant: "primary", disabled: false },
      ],
    });
  });

  it("updateDisabled sets submit button disabled state", () => {
    const actions = usePublishChromeActions({ onPublish: vi.fn(), onClear: vi.fn() });
    actions.updateDisabled(true);
    expect(setRegion).toHaveBeenCalledWith("bottom", {
      buttons: [
        { id: "publish-clear", label: "清空", variant: "ghost" },
        { id: "publish-submit", label: "发布", variant: "primary", disabled: true },
      ],
    });
  });

  it("updateDisabled(false) enables submit button", () => {
    const actions = usePublishChromeActions({ onPublish: vi.fn(), onClear: vi.fn() });
    actions.updateDisabled(false);
    expect(setRegion).toHaveBeenCalledWith("bottom", {
      buttons: [
        { id: "publish-clear", label: "清空", variant: "ghost" },
        { id: "publish-submit", label: "发布", variant: "primary", disabled: false },
      ],
    });
  });

  it("cleanup calls resetRegions", () => {
    const actions = usePublishChromeActions({ onPublish: vi.fn(), onClear: vi.fn() });
    actions.setup();
    actions.cleanup();
    expect(resetRegions).toHaveBeenCalled();
  });

  it("cleanup can be called without setup", () => {
    const actions = usePublishChromeActions({ onPublish: vi.fn(), onClear: vi.fn() });
    expect(() => actions.cleanup()).not.toThrow();
    expect(resetRegions).toHaveBeenCalled();
  });
});
