#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd(), "src");
const allowedFiles = new Set([
  path.normalize("src/ui/SafeHtml.vue"),
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (/\.(vue|ts|tsx|js|jsx)$/.test(entry.name)) files.push(fullPath);
  }

  return files;
}

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

const findings = [];

for (const file of walk(rootDir)) {
  const relativePath = path.normalize(path.relative(process.cwd(), file));
  if (allowedFiles.has(relativePath)) continue;

  const content = fs.readFileSync(file, "utf8");
  const matches = content.matchAll(/\bv-html\s*=/g);
  for (const match of matches) {
    findings.push({
      file: relativePath,
      line: lineNumberForIndex(content, match.index || 0),
    });
  }
}

if (!findings.length) {
  console.log("No raw v-html usage found outside SafeHtml.vue.");
  process.exit(0);
}

console.error("Raw v-html usage found outside SafeHtml.vue:");
for (const finding of findings) {
  console.error(`- ${finding.file}:${finding.line}`);
}
console.error("\nUse <SafeHtml :html=\"...\" /> or sanitizeHtml() before rendering trusted HTML.");
process.exit(1);
