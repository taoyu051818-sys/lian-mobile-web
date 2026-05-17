import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function getReducedMotionBlock(source: string) {
  const match = source.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  expect(match, "expected a reduced-motion media block").toBeTruthy();
  return match![1];
}

describe("floating chrome reduced-motion", () => {
  it("floating-chrome.css has reduced-motion block", () => {
    const source = readRepoFile("../../src/styles/floating-chrome.css");
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    const rmBlock = source.slice(source.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rmBlock).toContain("transition: none !important");
    expect(rmBlock).toContain("transform: none !important");
    expect(rmBlock).toContain("filter: none !important");
  });
});

describe("Feed detail reduced-motion guards", () => {
  const viewSource = readRepoFile("../../src/features/feed/FeedView.vue");
  const detailSource = readRepoFile("../../src/features/feed/useFeedDetail.ts");
  const sharedSource = readRepoFile("../../src/composables/useReducedMotion.ts");
  const immersiveSource = readRepoFile("../../src/styles/content-immersive-ui.css");
  const immersiveReducedMotionBlock = getReducedMotionBlock(immersiveSource);

  it("FeedView imports prefersReducedMotion from the shared module instead of defining it locally", () => {
    expect(viewSource).toContain(
      'import { prefersReducedMotion } from "../../composables/useReducedMotion"',
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
      'if (!payload || typeof window === "undefined" || prefersReducedMotion()) return;',
    );
    expect(detailSource).toContain(
      "if (deps.prefersReducedMotion()) {\n      resetDetailState();\n      return;\n    }",
    );
  });

  it("disables non-essential transitions without globally disabling all animation", () => {
    expect(immersiveReducedMotionBlock).toContain(".shell-chrome__tab");
    expect(immersiveReducedMotionBlock).toContain("transition: none");
    expect(immersiveReducedMotionBlock).not.toContain("animation: none");
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
  const viewSource = readRepoFile("../../src/features/feed/FeedView.vue");

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
  const detailSource = readRepoFile("../../src/features/feed/useFeedDetail.ts");
  const motionSource = readRepoFile("../../src/features/feed/useDetailCardifyMotion.ts");

  it("useDetailCardifyMotion saves and cancels return animation timeout handle", () => {
    expect(motionSource).toContain("let pendingReturnTimer: ReturnType<typeof setTimeout>");
    expect(motionSource).toContain("clearTimeout(pendingReturnTimer)");
    expect(motionSource).toContain("pendingReturnTimer = window.setTimeout(");
    expect(motionSource).toContain("cancelPendingReturnTimer()");
  });

  it("useFeedDetail cancels return timer on unmount", () => {
    const unmountMatch = detailSource.match(
      /onBeforeUnmount\(\(\) => \{[\s\S]*?cancelPendingReturnTimer\(\)/,
    );
    expect(unmountMatch).toBeTruthy();
  });

  it("useFeedDetail delegates to motion.cancelPendingReturnTimer in closeDetailWithCardify", () => {
    const closeMatch = detailSource.match(
      /function closeDetailWithCardify[\s\S]*?motion\.cancelPendingReturnTimer\(\)/,
    );
    expect(closeMatch).toBeTruthy();
  });
});
