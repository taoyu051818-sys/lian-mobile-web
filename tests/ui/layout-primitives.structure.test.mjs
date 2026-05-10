import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readSource(name) {
  return fs.readFileSync(path.join(repoRoot, "src/ui/layout", name), "utf8");
}

describe("PageSurface", () => {
  it("exposes as, bleed, and padded props", () => {
    const src = readSource("PageSurface.vue");
    expect(src).toMatch(/as\?\s*:\s*string/);
    expect(src).toMatch(/bleed\?\s*:\s*boolean/);
    expect(src).toMatch(/padded\?\s*:\s*boolean/);
  });

  it("applies BEM-lite classes", () => {
    const src = readSource("PageSurface.vue");
    expect(src).toMatch(/class="page-surface"/);
    expect(src).toMatch(/page-surface--bleed/);
    expect(src).toMatch(/page-surface--padded/);
  });

  it("defaults to <main> element", () => {
    const src = readSource("PageSurface.vue");
    expect(src).toMatch(/as:\s*"main"/);
  });
});

describe("PageSection", () => {
  it("exposes as, title, and description props", () => {
    const src = readSource("PageSection.vue");
    expect(src).toMatch(/as\?\s*:\s*string/);
    expect(src).toMatch(/title\?\s*:\s*string/);
    expect(src).toMatch(/description\?\s*:\s*string/);
  });

  it("has header and default slots", () => {
    const src = readSource("PageSection.vue");
    expect(src).toMatch(/name="header"/);
    expect(src).toMatch(/<slot\s*\/>/);
  });

  it("applies BEM-lite classes", () => {
    const src = readSource("PageSection.vue");
    expect(src).toMatch(/class="page-section"/);
    expect(src).toMatch(/page-section__header/);
    expect(src).toMatch(/page-section__title/);
    expect(src).toMatch(/page-section__description/);
  });
});

describe("ContentStack", () => {
  it("exposes as, gap, and align props", () => {
    const src = readSource("ContentStack.vue");
    expect(src).toMatch(/as\?\s*:\s*string/);
    expect(src).toMatch(/gap\?\s*:\s*"sm"\s*\|\s*"md"\s*\|\s*"lg"/);
    expect(src).toMatch(/align\?\s*:\s*"start"\s*\|\s*"center"\s*\|\s*"end"\s*\|\s*"stretch"/);
  });

  it("applies gap and align modifier classes", () => {
    const src = readSource("ContentStack.vue");
    expect(src).toMatch(/content-stack--gap-\$\{gap\}/);
    expect(src).toMatch(/content-stack--align-\$\{align\}/);
  });
});

describe("ActionRow", () => {
  it("exposes as, justify, and wrap props", () => {
    const src = readSource("ActionRow.vue");
    expect(src).toMatch(/as\?\s*:\s*string/);
    expect(src).toMatch(/justify\?\s*:\s*"start"\s*\|\s*"center"\s*\|\s*"end"\s*\|\s*"between"\s*\|\s*"around"/);
    expect(src).toMatch(/wrap\?\s*:\s*boolean/);
  });

  it("applies justify modifier and wrap class", () => {
    const src = readSource("ActionRow.vue");
    expect(src).toMatch(/action-row--justify-\$\{justify\}/);
    expect(src).toMatch(/action-row--wrap/);
  });
});

describe("EmptyState", () => {
  it("exposes icon, title, and description props", () => {
    const src = readSource("EmptyState.vue");
    expect(src).toMatch(/icon\?\s*:\s*string/);
    expect(src).toMatch(/title\?\s*:\s*string/);
    expect(src).toMatch(/description\?\s*:\s*string/);
  });

  it("has action slot", () => {
    const src = readSource("EmptyState.vue");
    expect(src).toMatch(/name="action"/);
  });

  it("uses role=status for accessibility", () => {
    const src = readSource("EmptyState.vue");
    expect(src).toMatch(/role="status"/);
  });

  it("applies BEM-lite classes", () => {
    const src = readSource("EmptyState.vue");
    expect(src).toMatch(/class="empty-state"/);
    expect(src).toMatch(/empty-state__icon/);
    expect(src).toMatch(/empty-state__title/);
    expect(src).toMatch(/empty-state__description/);
    expect(src).toMatch(/empty-state__action/);
  });
});
