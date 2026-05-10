import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const indexSource = fs.readFileSync(path.join(repoRoot, "src/ui/index.ts"), "utf8");

describe("ui/index.ts layout exports", () => {
  it("exports PageSurface from layout/", () => {
    expect(indexSource).toMatch(/export\s*\{\s*default\s+as\s+PageSurface\s*\}\s*from\s*"\.\/layout\/PageSurface\.vue"/);
  });

  it("exports PageSection from layout/", () => {
    expect(indexSource).toMatch(/export\s*\{\s*default\s+as\s+PageSection\s*\}\s*from\s*"\.\/layout\/PageSection\.vue"/);
  });

  it("exports ContentStack from layout/", () => {
    expect(indexSource).toMatch(/export\s*\{\s*default\s+as\s+ContentStack\s*\}\s*from\s*"\.\/layout\/ContentStack\.vue"/);
  });

  it("exports ActionRow from layout/", () => {
    expect(indexSource).toMatch(/export\s*\{\s*default\s+as\s+ActionRow\s*\}\s*from\s*"\.\/layout\/ActionRow\.vue"/);
  });

  it("exports EmptyState from layout/", () => {
    expect(indexSource).toMatch(/export\s*\{\s*default\s+as\s+EmptyState\s*\}\s*from\s*"\.\/layout\/EmptyState\.vue"/);
  });
});
