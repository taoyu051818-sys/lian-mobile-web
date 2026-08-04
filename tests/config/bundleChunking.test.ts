import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("production chunk boundaries", () => {
  it("keeps the post-detail renderer behind an async boundary", () => {
    const source = readRepoFile("../../src/app/DetailSurface.vue");

    expect(source).toContain("defineAsyncComponent");
    expect(source).toContain('import("../features/detail/PostDetailPanel.vue")');
    expect(source).not.toMatch(/import\s+\{\s*PostDetailPanel\s*\}\s+from/);
    expect(source).toContain('v-if="detail.detailOpen.value"');
  });

  it("isolates the Vue and i18n runtimes from feature code", () => {
    const source = readRepoFile("../../vite.config.ts");

    expect(source).toContain("manualChunks(id)");
    expect(source).toContain('return "vue-runtime"');
    expect(source).toContain('return "i18n-runtime"');
  });
});
