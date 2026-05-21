import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("usePublishSubmit routes both publish failure paths through the safe write-action mapper", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  const matches = src.match(/resolveWriteActionErrorMessage\("publish", error\)/g) || [];

  assert.equal(matches.length, 2);
  assert.match(src, /from "\.\.\/\.\.\/utils\/writeActionErrors"/);
});

test("usePublishSubmit no longer forwards raw publish errors with extractErrorMessage", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");

  assert.doesNotMatch(src, /extractErrorMessage\(/);
  assert.doesNotMatch(src, /ERROR_PUBLISH_GENERIC/);
});
