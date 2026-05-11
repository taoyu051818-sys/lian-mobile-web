#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceGuardPath = path.join(rootDir, "scripts/guard-public-runtime-exposure.js");
const sourceGuard = await fs.readFile(sourceGuardPath, "utf8");

async function writeFixtureFile(repoDir, relativePath, content) {
  const filePath = path.join(repoDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function createFixtureRepo(files) {
  const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), "lian-runtime-guard-"));
  await writeFixtureFile(repoDir, "scripts/guard-public-runtime-exposure.js", sourceGuard);
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFixtureFile(repoDir, relativePath, content);
  }
  return repoDir;
}

async function runGuardFixture(name, files, expectedStatus, expectedNeedle) {
  const repoDir = await createFixtureRepo(files);
  try {
    const result = await execFileAsync(process.execPath, ["scripts/guard-public-runtime-exposure.js"], {
      cwd: repoDir
    }).then(
      ({ stdout, stderr }) => ({ status: "pass", stdout, stderr }),
      (error) => ({
        status: "fail",
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        code: error.code
      })
    );

    assert.equal(result.status, expectedStatus, `${name} expected ${expectedStatus} but saw ${result.status}`);
    const combinedOutput = `${result.stdout}${result.stderr}`;
    assert.match(combinedOutput, expectedNeedle, `${name} output should mention ${expectedNeedle}`);
    console.log(`PASS ${name}`);
  } finally {
    await fs.rm(repoDir, { recursive: true, force: true });
  }
}

await runGuardFixture(
  "clean production fixture",
  {
    "index.html": "<!doctype html><html><body><div id=\"vue-root\"></div><script type=\"module\" src=\"/src/main.ts\"></script></body></html>",
    "src/main.ts": "console.log('ok');"
  },
  "pass",
  /Result: \d+ passed, 0 failed/
);

await runGuardFixture(
  "rehearsal marker fixture",
  {
    "index.html": "<!doctype html><html><body>LIAN_STATIC_REHEARSAL</body></html>"
  },
  "fail",
  /rehearsal marker/
);

await runGuardFixture(
  "internal tool path fixture",
  {
    "index.html": "<!doctype html><html><body><a href=\"\/tools\/debug\">debug</a></body></html>"
  },
  "fail",
  /internal\/debug path/
);
