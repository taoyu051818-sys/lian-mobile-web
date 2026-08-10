#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = Object.freeze({ node: 65, vitest: 169 });

async function countFiles(directory, suffix) {
  const entries = await readdir(directory, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) count += await countFiles(target, suffix);
    else if (entry.isFile() && entry.name.endsWith(suffix)) count += 1;
  }

  return count;
}

const counts = {
  node: await countFiles(path.join(repositoryRoot, "tests"), ".test.mjs"),
  vitest:
    (await countFiles(path.join(repositoryRoot, "tests"), ".test.ts")) +
    (await countFiles(path.join(repositoryRoot, "src"), ".test.ts")),
};

const mismatches = Object.entries(expected).filter(([key, value]) => counts[key] !== value);
if (mismatches.length > 0) {
  for (const [key, value] of mismatches) {
    console.error(
      `Test inventory changed for ${key}: expected ${value}, discovered ${counts[key]}.`,
    );
  }
  console.error(
    "Review the added or removed tests, then update the expected inventory intentionally.",
  );
  process.exit(1);
}

console.log(`Test inventory verified: ${counts.vitest} Vitest files, ${counts.node} Node files.`);
