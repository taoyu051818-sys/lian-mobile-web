import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { useFloatingChromeController } from "../../src/motion/floatingChrome";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("chrome transition lifecycle (#278)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("drives visible → exiting → entering → visible lifecycle", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    expect(chrome.phase.value).toBe("visible");

    // Start transition
    const started = chrome.transitionSpec({ content: "new" });
    expect(started).toBe(true);
    expect(chrome.phase.value).toBe("exiting");
    expect(chrome.progress.value).toBe(0);

    // After exiting duration, enters entering phase
    vi.advanceTimersByTime(100);
    expect(chrome.phase.value).toBe("entering");
    expect(chrome.progress.value).toBe(1);

    // After entering duration, back to visible
    vi.advanceTimersByTime(100);
    expect(chrome.phase.value).toBe("visible");
    expect(chrome.progress.value).toBe(1);

    chrome.dispose();
  });

  it("fires the onSwap callback between exiting and entering", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });
    const swapCalls: string[] = [];

    chrome.transitionSpec({ content: "new" }, () => {
      swapCalls.push("swap");
      // At swap time, phase should be exiting (about to become entering)
      expect(chrome.phase.value).toBe("exiting");
    });

    vi.advanceTimersByTime(100);
    expect(swapCalls).toEqual(["swap"]);

    chrome.dispose();
  });

  it("returns false and is a no-op when already in exiting phase", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.transitionSpec({ content: "first" });
    expect(chrome.phase.value).toBe("exiting");

    // Second call while exiting should be no-op
    const second = chrome.transitionSpec({ content: "second" });
    expect(second).toBe(false);
    expect(chrome.phase.value).toBe("exiting");

    chrome.dispose();
  });

  it("returns false and is a no-op when already in entering phase", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.transitionSpec({ content: "first" });
    vi.advanceTimersByTime(100); // now entering
    expect(chrome.phase.value).toBe("entering");

    const second = chrome.transitionSpec({ content: "second" });
    expect(second).toBe(false);
    expect(chrome.phase.value).toBe("entering");

    chrome.dispose();
  });

  it("returns false and is a no-op when in progress phase", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.setProgress(0.5);
    expect(chrome.phase.value).toBe("progress");

    const started = chrome.transitionSpec({ content: "new" });
    expect(started).toBe(false);
    expect(chrome.phase.value).toBe("progress");

    chrome.dispose();
  });

  it("uses default 220ms duration when phaseMs is not specified", () => {
    const chrome = useFloatingChromeController({ initialPhase: "visible" });

    chrome.transitionSpec({ content: "new" });
    expect(chrome.phase.value).toBe("exiting");

    // Not yet at 220ms
    vi.advanceTimersByTime(219);
    expect(chrome.phase.value).toBe("exiting");

    // At 220ms, transitions to entering
    vi.advanceTimersByTime(1);
    expect(chrome.phase.value).toBe("entering");

    // At 440ms total, back to visible
    vi.advanceTimersByTime(220);
    expect(chrome.phase.value).toBe("visible");

    chrome.dispose();
  });

  it("dispose() cancels pending timers and prevents further transitions", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.transitionSpec({ content: "new" });
    expect(chrome.phase.value).toBe("exiting");

    chrome.dispose();

    // Timer should have been cancelled
    vi.advanceTimersByTime(200);
    // Phase stays at exiting because dispose cancelled the timer
    expect(chrome.phase.value).toBe("exiting");

    // Further transitions should be rejected
    const started = chrome.transitionSpec({ content: "new" });
    expect(started).toBe(false);
  });

  it("dispose() cancels entering-to-visible timer", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.transitionSpec({ content: "new" });
    vi.advanceTimersByTime(100); // now entering
    expect(chrome.phase.value).toBe("entering");

    chrome.dispose();
    vi.advanceTimersByTime(200);
    // Stays entering because dispose cancelled the timer
    expect(chrome.phase.value).toBe("entering");
  });
});

describe("chrome transition lifecycle - reduced motion (#278)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves the full phase sequence with zero-duration transitions", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 0,
    });
    const phases: string[] = [];

    phases.push(chrome.phase.value);
    chrome.transitionSpec({ content: "new" });
    phases.push(chrome.phase.value); // exiting

    // setTimeout(fn, 0) still defers; advance to next timer
    vi.advanceTimersToNextTimer();
    phases.push(chrome.phase.value); // entering

    vi.advanceTimersToNextTimer();
    phases.push(chrome.phase.value); // visible

    expect(phases).toEqual(["visible", "exiting", "entering", "visible"]);
    chrome.dispose();
  });

  it("fires the onSwap callback even with zero duration", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 0,
    });
    let swapped = false;

    chrome.transitionSpec({ content: "new" }, () => {
      swapped = true;
    });

    vi.advanceTimersToNextTimer();
    expect(swapped).toBe(true);
    chrome.dispose();
  });
});

describe("chrome transition lifecycle - pointer events (#278)", () => {
  it("CSS disables pointer events during exiting phase", () => {
    const source = readRepoFile("../../src/styles/floating-chrome.css");

    // Exiting state should have pointer-events: none
    expect(source).toContain(
      'data-floating-state="exiting"',
    );
    // The hidden/exiting block sets pointer-events: none
    const exitingBlock = source.match(
      /\.lian-floating-chrome\[data-floating-state="hidden"\],[\s\S]*?pointer-events: none !important;/,
    );
    expect(exitingBlock).toBeTruthy();
  });

  it("CSS disables pointer events during entering phase", () => {
    const source = readRepoFile("../../src/styles/floating-chrome.css");

    // Entering state should have its own pointer-events: none rule
    const enteringPeNone = source.match(
      /\.lian-floating-chrome\[data-floating-state="entering"\][\s\S]*?pointer-events: none !important;/,
    );
    expect(enteringPeNone).toBeTruthy();
  });

  it("CSS enables pointer events only during visible state", () => {
    const source = readRepoFile("../../src/styles/floating-chrome.css");

    // Visible state has pointer-events: auto
    const visibleAuto = source.match(
      /\.lian-floating-chrome\[data-floating-state="visible"\][\s\S]*?pointer-events: auto !important;/,
    );
    expect(visibleAuto).toBeTruthy();
  });
});

describe("FloatingChromePhase honesty (#281)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("entering is a real lifecycle phase, not a collapsed no-op", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.transitionSpec({ content: "new" });
    vi.advanceTimersByTime(100);

    // Entering phase persists until its timer fires
    expect(chrome.phase.value).toBe("entering");
    expect(chrome.style.value["--floating-chrome-visibility-progress"]).toBe("1");

    // Still entering before timer fires
    vi.advanceTimersByTime(50);
    expect(chrome.phase.value).toBe("entering");

    // After timer, becomes visible
    vi.advanceTimersByTime(50);
    expect(chrome.phase.value).toBe("visible");

    chrome.dispose();
  });

  it("exiting is a real lifecycle phase, not a collapsed no-op", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.transitionSpec({ content: "new" });

    // Exiting phase persists until its timer fires
    expect(chrome.phase.value).toBe("exiting");
    expect(chrome.style.value["--floating-chrome-visibility-progress"]).toBe("0");

    // Still exiting before timer fires
    vi.advanceTimersByTime(50);
    expect(chrome.phase.value).toBe("exiting");

    chrome.dispose();
  });

  it("progress phase blocks transitionSpec (not silently overridden)", () => {
    const chrome = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    chrome.setProgress(0.5);
    expect(chrome.phase.value).toBe("progress");

    const started = chrome.transitionSpec({ content: "new" });
    expect(started).toBe(false);
    expect(chrome.phase.value).toBe("progress");

    chrome.dispose();
  });

  it("direct hide/show still works as immediate transitions", () => {
    const chrome = useFloatingChromeController({ initialPhase: "visible" });

    chrome.hide();
    expect(chrome.phase.value).toBe("hidden");
    expect(chrome.progress.value).toBe(0);

    chrome.show();
    expect(chrome.phase.value).toBe("visible");
    expect(chrome.progress.value).toBe(1);
  });
});

describe("independent region transitions (#278)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("two controllers can transition independently", () => {
    const top = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });
    const bottom = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 150,
    });

    // Both start transitioning in the same tick
    top.transitionSpec({ content: "top-new" });
    bottom.transitionSpec({ content: "bottom-new" });

    expect(top.phase.value).toBe("exiting");
    expect(bottom.phase.value).toBe("exiting");

    // After 100ms, top enters entering, bottom still exiting
    vi.advanceTimersByTime(100);
    expect(top.phase.value).toBe("entering");
    expect(bottom.phase.value).toBe("exiting");

    // After 150ms, bottom enters entering
    vi.advanceTimersByTime(50);
    expect(top.phase.value).toBe("entering");
    expect(bottom.phase.value).toBe("entering");

    // After 200ms, top visible, bottom still entering
    vi.advanceTimersByTime(50);
    expect(top.phase.value).toBe("visible");
    expect(bottom.phase.value).toBe("entering");

    // After 300ms, both visible
    vi.advanceTimersByTime(100);
    expect(top.phase.value).toBe("visible");
    expect(bottom.phase.value).toBe("visible");

    top.dispose();
    bottom.dispose();
  });

  it("one controller can transition while the other stays visible", () => {
    const top = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });
    const bottom = useFloatingChromeController({
      initialPhase: "visible",
      phaseMs: 100,
    });

    // Only top transitions
    top.transitionSpec({ content: "top-new" });

    expect(top.phase.value).toBe("exiting");
    expect(bottom.phase.value).toBe("visible");

    vi.advanceTimersByTime(200);
    expect(top.phase.value).toBe("visible");
    expect(bottom.phase.value).toBe("visible");

    top.dispose();
    bottom.dispose();
  });
});
