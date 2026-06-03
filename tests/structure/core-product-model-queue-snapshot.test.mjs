import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const queueSnapshot = readme.slice(
  readme.indexOf("Core Product Model V1 queue snapshot"),
  readme.indexOf("## Runtime model"),
);

test("README keeps the Core Product Model V1 queue snapshot visible", () => {
  assert.match(readme, /Core Product Model V1 queue snapshot/);
  assert.match(readme, /Snapshot source: GitHub issue truth checked on 2026-06-03/);
  assert.match(readme, /Phase order source: `taoyu051818-sys\/lian-mobile-web#995`/);
});

test("README records current open frontend child issues by phase", () => {
  assert.match(readme, /Phase 1 — Semantic layer: open frontend children `#964`, `#972`/);
  assert.match(
    readme,
    /Phase 2 — Identity and actionable publishing: open frontend children `#970`,\s+`#971`, `#991`, `#992`/,
  );
  assert.match(
    readme,
    /Phase 3 — Collaboration channels and local discovery: open frontend children\s+`#963`, `#976`/,
  );
  assert.match(readme, /Phase 4 — Collective action and settlement: open frontend child `#993`/);
});

test("README marks closed frontend children so contributors do not chase stale tickets", () => {
  for (const issue of ["#966", "#967", "#611", "#610", "#710", "#994", "#979", "#977", "#948"]) {
    assert.match(queueSnapshot, new RegExp(`${issue}[\\s\\S]*(closed|merged)`));
  }
});
