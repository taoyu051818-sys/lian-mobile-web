#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CODE_EXTENSIONS = new Set([".html", ".js", ".ts", ".vue"]);
const IGNORE_DIRS = new Set([
  ".git",
  "build",
  "coverage",
  "dist",
  "docs",
  "node_modules",
  "runtime-inventory"
]);
const IGNORE_FILES = new Set([
  "scripts/guard-unsafe-dom-sinks.js"
]);

const RULES = [
  {
    description: "raw v-html usage",
    regex: /\bv-html\s*=/g,
    allow(relativePath) {
      return relativePath === "src/ui/SafeHtml.vue" || relativePath === "src/views/detail/PostDetailPanel.vue";
    }
  },
  {
    description: "raw innerHTML usage",
    regex: /\binnerHTML\b/g,
    allow(relativePath) {
      return relativePath === "src/utils/html.ts" || relativePath.startsWith("public/");
    }
  },
  {
    description: "direct alert/prompt/confirm usage",
    regex: /\b(?:alert|prompt|confirm)\s*\(/g,
    allow(relativePath) {
      return relativePath.startsWith("public/");
    }
  }
];

function isCodeFile(filePath) {
  return CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (!entry.isFile() || !isCodeFile(fullPath)) continue;
    files.push(fullPath);
  }
  return files;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function lineTextAt(text, lineNumber) {
  return text.split(/\r?\n/)[lineNumber - 1] || "";
}

const findings = [];
for (const file of walk(ROOT)) {
  const relativePath = path.relative(ROOT, file).replace(/\\/g, "/");
  if (IGNORE_FILES.has(relativePath)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let match;
    while ((match = rule.regex.exec(text)) !== null) {
      if (rule.allow(relativePath, match)) continue;
      const line = lineNumberAt(text, match.index);
      findings.push({
        file: relativePath,
        line,
        description: rule.description,
        sample: lineTextAt(text, line).trim()
      });
    }
  }
}

if (findings.length) {
  console.error("Unsafe DOM sink guard failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.description}`);
    console.error(`  ${finding.sample}`);
  }
  process.exit(1);
}

console.log(`Unsafe DOM sink guard passed (${walk(ROOT).length} code files checked).`);
