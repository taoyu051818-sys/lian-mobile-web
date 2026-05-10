import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cssSource = fs.readFileSync(path.join(repoRoot, "src/ui/primitives.css"), "utf8");

describe("primitives.css layout styles", () => {
  it("defines page-surface styles", () => {
    expect(cssSource).toMatch(/\.page-surface\s*\{/);
    expect(cssSource).toMatch(/\.page-surface--padded/);
    expect(cssSource).toMatch(/\.page-surface--bleed/);
  });

  it("defines page-section styles", () => {
    expect(cssSource).toMatch(/\.page-section\s*\{/);
    expect(cssSource).toMatch(/\.page-section__header/);
    expect(cssSource).toMatch(/\.page-section__title/);
    expect(cssSource).toMatch(/\.page-section__description/);
  });

  it("defines content-stack styles", () => {
    expect(cssSource).toMatch(/\.content-stack\s*\{/);
    expect(cssSource).toMatch(/\.content-stack--gap-sm/);
    expect(cssSource).toMatch(/\.content-stack--gap-md/);
    expect(cssSource).toMatch(/\.content-stack--gap-lg/);
  });

  it("defines action-row styles", () => {
    expect(cssSource).toMatch(/\.action-row\s*\{/);
    expect(cssSource).toMatch(/\.action-row--justify-start/);
    expect(cssSource).toMatch(/\.action-row--justify-end/);
    expect(cssSource).toMatch(/\.action-row--justify-between/);
    expect(cssSource).toMatch(/\.action-row--wrap/);
  });

  it("defines empty-state styles", () => {
    expect(cssSource).toMatch(/\.empty-state\s*\{/);
    expect(cssSource).toMatch(/\.empty-state__icon/);
    expect(cssSource).toMatch(/\.empty-state__title/);
    expect(cssSource).toMatch(/\.empty-state__description/);
    expect(cssSource).toMatch(/\.empty-state__action/);
  });

  it("uses CSS custom properties for spacing", () => {
    expect(cssSource).toMatch(/var\(--space-/);
  });

  it("uses safe-area-inset for bottom padding", () => {
    expect(cssSource).toMatch(/env\(safe-area-inset-bottom\)/);
  });
});
