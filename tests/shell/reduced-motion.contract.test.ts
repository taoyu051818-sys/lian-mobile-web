import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { useFloatingChromeController } from "../../src/motion/floatingChrome";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function getReducedMotionBlock(source: string) {
  const match = source.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  expect(match, "expected a reduced-motion media block").toBeTruthy();
  return match![1];
}

describe("floating chrome reduced-motion contract", () => {
  it("switches visible and hidden states immediately", () => {
    const chrome = useFloatingChromeController({ initialPhase: "visible" });

    chrome.hide();
    expect(chrome.phase.value).toBe("hidden");
    expect(chrome.style.value["--floating-chrome-visibility-progress"]).toBe("0");
    expect(chrome.style.value["--bottom-chrome-visibility-progress"]).toBe("0");

    chrome.show();
    expect(chrome.phase.value).toBe("visible");
    expect(chrome.style.value["--floating-chrome-visibility-progress"]).toBe("1");
    expect(chrome.style.value["--bottom-chrome-visibility-progress"]).toBe("1");
  });

  it("keeps drag progress explicit without introducing transition phases", () => {
    const chrome = useFloatingChromeController({ initialPhase: "hidden" });

    chrome.setProgress(0.35);
    expect(chrome.phase.value).toBe("progress");
    expect(chrome.progress.value).toBeCloseTo(0.35, 5);
    expect(chrome.style.value["--floating-chrome-drag-progress"]).toBe("0.35");
  });

  it("uses restrained visual motion with strict reduced-motion fallback for floating chrome surfaces", () => {
    const source = readRepoFile("../../src/styles/floating-chrome.css");

    // Normal motion uses tokenized duration
    expect(source).toContain("--floating-chrome-motion-duration: var(--motion-fast)");
    // Progress state selector exists
    expect(source).toContain('.lian-floating-chrome[data-floating-state="progress"]');
    // Reduced-motion block enforces strict no-motion
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    const rmBlock = source.slice(source.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rmBlock).toContain("transition: none !important");
    expect(rmBlock).toContain("transform: none !important");
    expect(rmBlock).toContain("filter: none !important");
  });
});

describe("Feed detail reduced-motion guards", () => {
  const viewSource = readRepoFile("../../src/views/FeedView.vue");
  const detailSource = readRepoFile("../../src/views/feed/useFeedDetail.ts");
  const sharedSource = readRepoFile("../../src/motion/useReducedMotion.ts");
  const reducedMotionBlock = getReducedMotionBlock(viewSource);

  it("FeedView imports prefersReducedMotion from the shared module instead of defining it locally", () => {
    expect(viewSource).toContain(
      'import { prefersReducedMotion } from "../motion/useReducedMotion"'
    );
    // Local function definition must be gone
    expect(viewSource).not.toContain("function prefersReducedMotion()");
  });

  it("shared module exports prefersReducedMotion with SSR-safe matchMedia check", () => {
    expect(sharedSource).toContain("export function prefersReducedMotion");
    expect(sharedSource).toContain("window.matchMedia");
    expect(sharedSource).toContain("prefers-reduced-motion: reduce");
  });

  it("short-circuits detail open and close motion when reduced motion is enabled", () => {
    expect(viewSource).toContain(
      'if (!payload || typeof window === "undefined" || prefersReducedMotion()) return;'
    );
    expect(detailSource).toContain("if (deps.prefersReducedMotion()) {\n      resetDetailState();\n      return;\n    }");
  });

  it("disables non-essential feed detail transitions without globally disabling all animation", () => {
    expect(reducedMotionBlock).toContain(".feed-view__content,");
    expect(reducedMotionBlock).toContain(".feed-view__card-transition {");
    expect(reducedMotionBlock).toContain("transition: none;");
    expect(reducedMotionBlock).not.toContain(".feed-update-probe-motion-enter-active");
    expect(reducedMotionBlock).not.toContain(".feed-update-probe-motion-leave-active");
    expect(reducedMotionBlock).not.toContain("animation: none");
  });
});

describe("card camera reduced-motion stylesheet", () => {
  it("turns off card transition transforms and filters under reduced motion", () => {
    const source = readRepoFile("../../src/styles/card-camera-transition.css");
    const reducedMotionBlock = getReducedMotionBlock(source);

    expect(reducedMotionBlock).toContain(".feed-view__card-transition,");
    expect(reducedMotionBlock).toContain(".feed-view__card-transition.is-active,");
    expect(reducedMotionBlock).toContain(".feed-view__card-transition img,");
    expect(reducedMotionBlock).toContain(".feed-view__card-transition strong,");
    expect(reducedMotionBlock).toContain(".feed-view__card-transition-tag {");
    expect(reducedMotionBlock).toContain("transition: none !important;");
    expect(reducedMotionBlock).toContain("transform: none !important;");
    expect(reducedMotionBlock).toContain("filter: none !important;");
    expect(reducedMotionBlock).not.toContain("animation: none");
  });
});

describe("shell chrome tabs reduced-motion stylesheet", () => {
  it("disables tab transitions under reduced motion", () => {
    const source = readRepoFile("../../src/shell/shell-chrome.css");
    const reducedMotionBlock = getReducedMotionBlock(source);

    expect(reducedMotionBlock).toContain(".shell-chrome__tab");
    expect(reducedMotionBlock).not.toContain(".feed-view__tab");
    expect(reducedMotionBlock).toContain("transition: none");
  });
});

describe("card camera timer hygiene (#254)", () => {
  const viewSource = readRepoFile("../../src/views/FeedView.vue");

  it("FeedView saves and cancels card transition rAF handle", () => {
    expect(viewSource).toContain("let pendingCardRaf = 0");
    expect(viewSource).toContain("cancelAnimationFrame(pendingCardRaf)");
    expect(viewSource).toContain("pendingCardRaf = requestAnimationFrame(");
    expect(viewSource).toContain("cancelCardTransitionTimers()");
  });

  it("FeedView saves and cancels card transition timeout handle", () => {
    expect(viewSource).toContain("let pendingCardTimer: ReturnType<typeof setTimeout>");
    expect(viewSource).toContain("clearTimeout(pendingCardTimer)");
    expect(viewSource).toContain("pendingCardTimer = window.setTimeout(");
  });

  it("FeedView cancels card transition timers on unmount", () => {
    // The onBeforeUnmount hook should call cancelCardTransitionTimers
    const unmountMatch = viewSource.match(
      /onBeforeUnmount\(\(\) => \{[\s\S]*?cancelCardTransitionTimers\(\)/,
    );
    expect(unmountMatch).toBeTruthy();
  });
});

describe("detail return timer hygiene (#254)", () => {
  const detailSource = readRepoFile("../../src/views/feed/useFeedDetail.ts");

  it("useFeedDetail saves and cancels return animation timeout handle", () => {
    expect(detailSource).toContain("let pendingReturnTimer: ReturnType<typeof setTimeout>");
    expect(detailSource).toContain("clearTimeout(pendingReturnTimer)");
    expect(detailSource).toContain("pendingReturnTimer = window.setTimeout(");
    expect(detailSource).toContain("cancelPendingReturnTimer()");
  });

  it("useFeedDetail cancels return timer on unmount", () => {
    const unmountMatch = detailSource.match(
      /onBeforeUnmount\(\(\) => \{[\s\S]*?cancelPendingReturnTimer\(\)/,
    );
    expect(unmountMatch).toBeTruthy();
  });

  it("useFeedDetail cancels existing return timer when a new close supersedes", () => {
    // closeDetailWithCardify should call cancelPendingReturnTimer before creating new timer
    const closeMatch = detailSource.match(
      /function closeDetailWithCardify[\s\S]*?cancelPendingReturnTimer\(\)[\s\S]*?pendingReturnTimer = window\.setTimeout/,
    );
    expect(closeMatch).toBeTruthy();
  });
});
