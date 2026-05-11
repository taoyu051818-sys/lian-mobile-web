import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeChromeProgress,
  useFloatingChromeController,
} from "../../src/motion/floatingChrome";

describe("normalizeChromeProgress", () => {
  it("clamps invalid and out-of-range values", () => {
    expect(normalizeChromeProgress(undefined)).toBe(0);
    expect(normalizeChromeProgress("bad")).toBe(0);
    expect(normalizeChromeProgress(-0.5)).toBe(0);
    expect(normalizeChromeProgress(0.35)).toBe(0.35);
    expect(normalizeChromeProgress(2)).toBe(1);
  });
});

describe("useFloatingChromeController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("keeps the full exit-swap-enter-visible sequence for chrome spec transitions", () => {
    const controller = useFloatingChromeController({ phaseMs: 24 });
    const onSwap = vi.fn();

    expect(controller.phase.value).toBe("visible");
    expect(controller.transitionSpec({ region: "tabs" }, onSwap)).toBe(true);
    expect(controller.phase.value).toBe("exiting");
    expect(onSwap).not.toHaveBeenCalled();

    vi.advanceTimersByTime(24);
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(controller.phase.value).toBe("entering");

    vi.advanceTimersByTime(24);
    expect(controller.phase.value).toBe("visible");
    expect(controller.progress.value).toBe(1);
  });

  it("treats zero-duration transitions as deterministic reduced-motion coverage", () => {
    const controller = useFloatingChromeController({ phaseMs: 0 });
    const onSwap = vi.fn();

    expect(controller.transitionSpec({ region: "tabs" }, onSwap)).toBe(true);
    expect(controller.phase.value).toBe("exiting");

    vi.runAllTimers();

    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(controller.phase.value).toBe("visible");
    expect(controller.style.value["--floating-chrome-visibility-progress"]).toBe("1");
  });

  it("blocks tab interaction windows while entering or exiting", () => {
    const controller = useFloatingChromeController({ phaseMs: 10 });

    controller.transitionSpec({ region: "tabs" }, () => {});
    expect(controller.phase.value).toBe("exiting");
    expect(controller.transitionSpec({ region: "detail" }, () => {})).toBe(false);

    vi.advanceTimersByTime(10);
    expect(controller.phase.value).toBe("entering");
    expect(controller.transitionSpec({ region: "detail" }, () => {})).toBe(false);
  });

  it("supports gesture progress and settles back to the requested phase", () => {
    const controller = useFloatingChromeController();

    controller.setProgress(0.42);
    expect(controller.phase.value).toBe("progress");
    expect(controller.progress.value).toBe(0.42);

    controller.settle("hidden");
    expect(controller.phase.value).toBe("hidden");
    expect(controller.style.value["--floating-chrome-visibility-progress"]).toBe("0");
  });

  it("cleans up pending timers on dispose", () => {
    const controller = useFloatingChromeController({ phaseMs: 16 });
    const onSwap = vi.fn();

    controller.transitionSpec({ region: "tabs" }, onSwap);
    controller.dispose();
    vi.runAllTimers();

    expect(onSwap).not.toHaveBeenCalled();
    expect(controller.phase.value).toBe("exiting");
  });
});
