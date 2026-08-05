import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const indexSource = fs.readFileSync(path.join(repoRoot, "src/ui/index.ts"), "utf8");

test("ui/index.ts exports PageSurface from layout/", () => {
  assert.match(
    indexSource,
    /export\s*\{\s*default\s+as\s+PageSurface\s*\}\s*from\s*"\.\/layout\/PageSurface\.vue"/,
  );
});

test("ui/index.ts exports EmptyState from layout/", () => {
  assert.match(
    indexSource,
    /export\s*\{\s*default\s+as\s+EmptyState\s*\}\s*from\s*"\.\/layout\/EmptyState\.vue"/,
  );
});
