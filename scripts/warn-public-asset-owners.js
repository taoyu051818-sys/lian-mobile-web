/**
 * warn-public-asset-owners.js
 *
 * WARNING-ONLY guard: checks that every first-level item in public/assets/
 * is mentioned in public/assets/README.md.  Prints a warning for anything
 * that is not listed.  Always exits 0 (never fails the build).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(rootDir, "public", "assets");
const readmePath = path.join(assetsDir, "README.md");

async function main() {
  let readmeContent;
  try {
    readmeContent = await fs.readFile(readmePath, "utf8");
  } catch {
    console.warn("[WARNING] warn-public-asset-owners: Could not read public/assets/README.md");
    process.exit(0);
  }

  let entries;
  try {
    entries = await fs.readdir(assetsDir, { withFileTypes: true });
  } catch {
    console.warn("[WARNING] warn-public-asset-owners: Could not read public/assets/ directory");
    process.exit(0);
  }

  // Filter out README.md itself
  const items = entries
    .filter((e) => e.name !== "README.md")
    .map((e) => ({
      name: e.name,
      isDir: e.isDirectory(),
    }));

  let warningCount = 0;

  for (const item of items) {
    const name = item.name;
    const label = item.isDir ? `${name}/` : name;

    // Check if the item name (or a pattern that could match it) appears in the README.
    // We do a simple case-insensitive substring check for the exact name.
    const nameLower = name.toLowerCase();
    const readmeLower = readmeContent.toLowerCase();

    if (readmeLower.includes(nameLower)) {
      continue;
    }

    // Also check for glob-style patterns: if the file matches a documented wildcard
    // e.g. campus-*.png should match campus-base-map.png
    // We extract backtick-quoted tokens from the table rows and test simple glob matches.
    const tablePatternRe = /\|\s*`([^`]+)`\s*\|/g;
    let matched = false;
    let m;
    while ((m = tablePatternRe.exec(readmeContent)) !== null) {
      const pattern = m[1].trim();
      if (simpleGlobMatch(pattern, name)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      console.warn(`[WARNING] warn-public-asset-owners: "${label}" is not listed in public/assets/README.md`);
      warningCount++;
    }
  }

  if (warningCount === 0) {
    console.log("warn-public-asset-owners: All items in public/assets/ are accounted for in the README.");
  } else {
    console.warn(`warn-public-asset-owners: ${warningCount} unlisted item(s) found.`);
  }

  // Always exit 0 — warning only
  process.exit(0);
}

/**
 * Very simple glob matcher supporting only * as a wildcard.
 * Handles patterns like "campus-*.png", "*-transparent.png", "aliases/".
 */
function simpleGlobMatch(pattern, filename) {
  // If pattern ends with "/" it matches directories; strip the slash for comparison
  const cleanPattern = pattern.replace(/\/$/, "");
  const cleanName = filename.replace(/\/$/, "");

  // Convert glob pattern to regex: escape special chars, replace * with .*
  const regexStr = "^" + cleanPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
  const regex = new RegExp(regexStr, "i");
  return regex.test(cleanName);
}

main();
