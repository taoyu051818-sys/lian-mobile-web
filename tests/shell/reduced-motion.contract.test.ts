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

  it("uses a permanent no-motion stylesheet contract for floating chrome surfaces", () => {
    const source = readRepoFile("../../src/styles/floating-chrome.css");

    expect(source).toContain("--floating-chrome-motion-duration: 0ms;");
    expect(source).toContain("transition: none !important;");
    expect(source).toContain('.lian-floating-chrome[data-floating-state="progress"]');
    expect(source).not.toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("Feed detail reduced-motion guards", () => {
  const viewSource = readRepoFile("../../src/views/FeedView.vue");
  const detailSource = readRepoFile("../../src/views/feed/useFeedDetail.ts");
  const reducedMotionBlock = getReducedMotionBlock(viewSource);

  it("short-circuits detail open and close motion when reduced motion is enabled", () => {
    expect(viewSource).toContain(
      'if (!payload || typeof window === "undefined" || prefersReducedMotion()) return;'
    );
    expect(detailSource).toContain("if (deps.prefersReducedMotion()) {\n      resetDetailState();\n      return;\n    }");
  });

  it("disables non-essential feed detail transitions without globally disabling all animation", () => {
    expect(reducedMotionBlock).toContain(".feed-view__content,");
    expect(reducedMotionBlock).toContain(".feed-view__card-transition,");
    expect(reducedMotionBlock).toContain(".feed-update-probe-motion-enter-active,");
    expect(reducedMotionBlock).toContain(".feed-update-probe-motion-leave-active {");
    expect(reducedMotionBlock).toContain("transition: none;");
    expect(reducedMotionBlock).toContain("transform: none;");
    expect(reducedMotionBlock).toContain("filter: none;");
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
