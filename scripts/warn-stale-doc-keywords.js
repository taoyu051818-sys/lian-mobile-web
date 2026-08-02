/**
 * warn-stale-doc-keywords.js
 *
 * WARNING-ONLY guard: scans markdown docs for stale keywords and verifies the
 * stable current-status entrypoint.
 * Prints a WARNING with the file path and matched keyword for each hit.
 * Always exits 0 (never fails the build).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(rootDir, "docs");

const STALE_KEYWORDS = ["superseded", "historical", "frozen", "not yet implemented", "draft"];
const CURRENT_STATUS_FILE = "docs/CURRENT_STATUS.md";
const REQUIRED_CURRENT_STATUS_MARKERS = [
  "Last verified:",
  "Active control issue:",
  "Open release blockers:",
  "Current production release:",
  "No active execution queue.",
];

async function walkMdFiles(dir) {
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
      results.push(...(await walkMdFiles(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const mdFiles = [path.join(rootDir, "README.md"), ...(await walkMdFiles(docsDir))];

  if (mdFiles.length === 0) {
    console.log("warn-stale-doc-keywords: No .md files found in docs/.");
    process.exit(0);
  }

  let warningCount = 0;

  for (const filePath of mdFiles) {
    let content;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const contentLower = content.toLowerCase();
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

    for (const keyword of STALE_KEYWORDS) {
      if (contentLower.includes(keyword)) {
        console.warn(
          `[WARNING] warn-stale-doc-keywords: "${relPath}" contains stale keyword: "${keyword}"`,
        );
        warningCount++;
      }
    }
  }

  if (warningCount === 0) {
    console.log("warn-stale-doc-keywords: No stale keywords found in docs/.");
  } else {
    console.warn(`warn-stale-doc-keywords: ${warningCount} stale keyword occurrence(s) found.`);
  }

  const currentStatusPath = path.join(rootDir, CURRENT_STATUS_FILE);
  try {
    const currentStatus = await fs.readFile(currentStatusPath, "utf8");
    const missingMarkers = REQUIRED_CURRENT_STATUS_MARKERS.filter(
      (marker) => !currentStatus.includes(marker),
    );

    if (missingMarkers.length === 0) {
      console.log("warn-stale-doc-keywords: Current status markers present.");
    } else {
      for (const marker of missingMarkers) {
        console.warn(
          `[WARNING] warn-stale-doc-keywords: "${CURRENT_STATUS_FILE}" is missing current status marker: "${marker}"`,
        );
      }
    }
  } catch {
    console.warn(
      `[WARNING] warn-stale-doc-keywords: "${CURRENT_STATUS_FILE}" could not be read for current status check.`,
    );
  }

  // Always exit 0 — warning only
  process.exit(0);
}

main();
