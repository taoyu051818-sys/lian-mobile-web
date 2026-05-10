import { describe, it, expect, vi, beforeEach } from "vitest";

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
    const onPublish = vi.fn();
    const onClear = vi.fn();
    const actions = usePublishChromeActions({ onPublish, onClear });
    actions.setup();
    const buttons = setRegion.mock.calls[0][1].buttons;
    expect(buttons).toMatchObject([
      { id: "publish-clear", label: "清空", variant: "ghost" },
      { id: "publish-submit", label: "发布", variant: "primary", disabled: false },
    ]);
  });

  it("updateDisabled sets submit button disabled state", () => {
    const onPublish = vi.fn();
    const onClear = vi.fn();
    const actions = usePublishChromeActions({ onPublish, onClear });
    actions.updateDisabled(true);
    const buttons = setRegion.mock.calls[0][1].buttons;
    expect(buttons).toMatchObject([
      { id: "publish-clear", label: "清空", variant: "ghost" },
      { id: "publish-submit", label: "发布", variant: "primary", disabled: true },
    ]);
  });

  it("updateDisabled(false) enables submit button", () => {
    const onPublish = vi.fn();
    const onClear = vi.fn();
    const actions = usePublishChromeActions({ onPublish, onClear });
    actions.updateDisabled(false);
    const buttons = setRegion.mock.calls[0][1].buttons;
    expect(buttons).toMatchObject([
      { id: "publish-clear", label: "清空", variant: "ghost" },
      { id: "publish-submit", label: "发布", variant: "primary", disabled: false },
    ]);
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

  it("button specs include onClick handlers for the provided callbacks", () => {
    const onPublish = vi.fn();
    const onClear = vi.fn();
    const actions = usePublishChromeActions({ onPublish, onClear });
    actions.setup();
    const buttons = setRegion.mock.calls[0][1].buttons;
    expect(buttons[0].onClick).toBe(onClear);
    expect(buttons[1].onClick).toBe(onPublish);
  });

  it("onClick handlers are updated when updateDisabled is called", () => {
    const onPublish = vi.fn();
    const onClear = vi.fn();
    const actions = usePublishChromeActions({ onPublish, onClear });
    actions.setup();
    actions.updateDisabled(true);
    const buttons = setRegion.mock.calls[1][1].buttons;
    expect(buttons[0].onClick).toBe(onClear);
    expect(buttons[1].onClick).toBe(onPublish);
  });
});
