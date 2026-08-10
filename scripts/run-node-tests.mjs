#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsRoot = path.join(repositoryRoot, "tests");

async function collectNodeTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectNodeTests(target)));
    } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      files.push(target);
    }
  }

  return files;
}

const testFiles = (await collectNodeTests(testsRoot)).sort((left, right) =>
  left.localeCompare(right),
);

if (testFiles.length === 0) {
  console.error("No tests/**/*.test.mjs files were discovered.");
  process.exit(1);
}

console.log(`Running ${testFiles.length} Node test files.`);

const child = spawn(process.execPath, ["--test", "--test-concurrency=1", ...testFiles], {
  cwd: repositoryRoot,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`Unable to start Node tests: ${error.message}`);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`Node tests stopped by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
