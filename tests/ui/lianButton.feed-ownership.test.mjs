import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const lianButtonSource = fs.readFileSync(path.join(repoRoot, "src/ui/LianButton.vue"), "utf8");

describe("LianButton feed ownership guards", () => {
  it("stays free of Feed auto-load ownership", () => {
    expect(lianButtonSource).not.toMatch(/IntersectionObserver/);
    expect(lianButtonSource).not.toMatch(/feed-view__load-more/);
    expect(lianButtonSource).not.toMatch(/loadMoreSentinelRef/);
    expect(lianButtonSource).not.toMatch(/useAutoLoadSentinel/);
  });

  it("still gates click events through disabled and loading state", () => {
    expect(lianButtonSource).toMatch(/function isDisabled\(\)/);
    expect(lianButtonSource).toMatch(/return props\.disabled \|\| props\.loading;/);
    expect(lianButtonSource).toMatch(/if \(isDisabled\(\)\) return;/);
    expect(lianButtonSource).toMatch(/emit\("click", event\);/);
    expect(lianButtonSource).toMatch(/:disabled="disabled \|\| loading"/);
  });
});
