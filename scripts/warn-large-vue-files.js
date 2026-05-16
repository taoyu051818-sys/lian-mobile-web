/**
 * warn-large-vue-files.js
 *
 * WARNING-ONLY guard: scans all .vue files under src/ and prints a warning
 * for any file exceeding 300 lines.  Always exits 0 (never fails the build).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "src");
const LINE_THRESHOLD = 300;

async function walkVueFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkVueFiles(fullPath)));
    } else if (entry.name.endsWith(".vue")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const vueFiles = await walkVueFiles(srcDir);

  if (vueFiles.length === 0) {
    console.log("warn-large-vue-files: No .vue files found in src/.");
    process.exit(0);
  }

  let warningCount = 0;

  for (const filePath of vueFiles) {
    let content;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const lineCount = content.split("\n").length;

    if (lineCount > LINE_THRESHOLD) {
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
      console.warn(`[WARNING] warn-large-vue-files: "${relPath}" has ${lineCount} lines (threshold: ${LINE_THRESHOLD})`);
      warningCount++;
    }
  }

  if (warningCount === 0) {
    console.log(`warn-large-vue-files: All .vue files are under ${LINE_THRESHOLD} lines.`);
  } else {
    console.warn(`warn-large-vue-files: ${warningCount} file(s) exceed ${LINE_THRESHOLD} lines.`);
  }

  // Always exit 0 — warning only
  process.exit(0);
}

main();
