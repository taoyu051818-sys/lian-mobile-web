import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
}

describe("transient UI timeout cleanup", () => {
  it("FeedContextMenu clears its delayed hide timer on unmount", () => {
    const source = read("src/features/feed/FeedContextMenu.vue");

    expect(source).toMatch(/let hideTimer: ReturnType<typeof setTimeout> \| null = null;/);
    expect(source).toMatch(/function clearHideTimer\(\)/);
    expect(source).toMatch(/hideTimer = setTimeout\(\(\) => \{/);
    expect(source).toMatch(/onBeforeUnmount\(\(\) => \{[\s\S]*?clearHideTimer\(\);[\s\S]*?\}\);/);
  });

  it("AdminAuthLinkBlock clears copy feedback timers before replacement and unmount", () => {
    const source = read("src/features/admin/AdminAuthLinkBlock.vue");

    expect(source).toMatch(/import \{ computed, onBeforeUnmount, ref \} from "vue";/);
    expect(source).toMatch(/let copyFeedbackTimer: ReturnType<typeof setTimeout> \| null = null;/);
    expect(source).toMatch(/function clearCopyFeedbackTimer\(\)/);
    expect(source).toMatch(/clearCopyFeedbackTimer\(\);\n\s*copyFeedback\.value = link\.token;/);
    expect(source).toMatch(/copyFeedbackTimer = setTimeout\(\(\) => \{/);
    expect(source).toMatch(/onBeforeUnmount\(clearCopyFeedbackTimer\);/);
  });

  it("MapCanvas disconnects responsive Konva sizing before teardown", () => {
    const source = read("src/features/map/MapCanvas.vue");

    expect(source).toMatch(/let resizeObserver: ResizeObserver \| null = null;/);
    expect(source).toMatch(/resizeObserver = new ResizeObserver\(\(\[entry\]\) => \{/);
    expect(source).toMatch(/resizeObserver\.observe\(rootEl\.value\);/);
    expect(source).toMatch(
      /onBeforeUnmount\(\(\) => \{[\s\S]*?resizeObserver\?\.disconnect\(\);[\s\S]*?resizeObserver = null;[\s\S]*?\}\);/,
    );
  });

  it("MapCanvas clears long-press hold timers before teardown", () => {
    const source = read("src/features/map/MapCanvas.vue");

    expect(source).toMatch(/let holdTimer: ReturnType<typeof setTimeout> \| null = null;/);
    expect(source).toMatch(/function clearLongpress\(\)/);
    expect(source).toMatch(
      /function handlePointerDown\(\) \{[\s\S]*?clearLongpress\(\);[\s\S]*?holdTimer = setTimeout\(\(\) => \{/,
    );
    expect(source).toMatch(/holdTimer = setTimeout\(\(\) => \{/);
    expect(source).toMatch(
      /onBeforeUnmount\(\(\) => \{[\s\S]*?clearLongpress\(\);[\s\S]*?resizeObserver\?\.disconnect\(\);[\s\S]*?\}\);/,
    );
  });
});
