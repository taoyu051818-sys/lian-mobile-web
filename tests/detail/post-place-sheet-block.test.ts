import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const blockSource = readFileSync(
  path.join(repoRoot, "src/features/detail/PostPlaceSheetBlock.vue"),
  "utf8",
);

describe("PostPlaceSheetBlock", () => {
  it("normalizes raw place types through placeTypeLabel before rendering", () => {
    expect(blockSource).toMatch(/import\s+\{\s*placeTypeLabel\s*\}\s+from\s+"\.\.\/\.\.\/domain\/place"/);
    expect(blockSource).toMatch(/const placeTypeText = computed\(/);
    expect(blockSource).toMatch(/return placeTypeLabel\(primary, secondary\)/);
  });

  it("renders the normalized type text instead of the raw backend string", () => {
    expect(blockSource).toMatch(/<span v-if="placeTypeText">\{\{ placeTypeText \}\}<\/span>/);
    expect(blockSource).not.toMatch(/placeSheet\?\.type \|\| structuredPlace\?\.type/);
  });
});
