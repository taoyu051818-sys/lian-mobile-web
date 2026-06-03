/**
 * warn-stale-doc-keywords.js
 *
 * WARNING-ONLY guard: scans markdown docs for stale keywords and queue snapshot
 * maintenance reminders.
 * Prints a WARNING with the file path and matched keyword for each hit.
 * Always exits 0 (never fails the build).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(rootDir, "docs");

const STALE_KEYWORDS = ["superseded", "historical", "frozen", "not yet implemented", "draft"];
const QUEUE_SNAPSHOT_FILE = "README.md";
const QUEUE_SNAPSHOT_HEADING = "Core Product Model V1 queue snapshot";
const REQUIRED_QUEUE_SNAPSHOT_MARKERS = [
  "Snapshot source: GitHub issue truth checked on",
  "Phase order source: `taoyu051818-sys/lian-mobile-web#995`",
  "closed children are context, not active queue items",
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
  const mdFiles = [path.join(rootDir, QUEUE_SNAPSHOT_FILE), ...(await walkMdFiles(docsDir))];

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

  const readmePath = path.join(rootDir, QUEUE_SNAPSHOT_FILE);
  try {
    const readme = await fs.readFile(readmePath, "utf8");
    const missingMarkers = [QUEUE_SNAPSHOT_HEADING, ...REQUIRED_QUEUE_SNAPSHOT_MARKERS].filter(
      (marker) => !readme.includes(marker),
    );

    if (missingMarkers.length === 0) {
      console.log("warn-stale-doc-keywords: Core Product Model V1 queue snapshot present.");
    } else {
      for (const marker of missingMarkers) {
        console.warn(
          `[WARNING] warn-stale-doc-keywords: "${QUEUE_SNAPSHOT_FILE}" is missing queue snapshot marker: "${marker}"`,
        );
      }
    }
  } catch {
    console.warn(
      `[WARNING] warn-stale-doc-keywords: "${QUEUE_SNAPSHOT_FILE}" could not be read for queue snapshot check.`,
    );
  }

  // Always exit 0 — warning only
  process.exit(0);
}

main();
