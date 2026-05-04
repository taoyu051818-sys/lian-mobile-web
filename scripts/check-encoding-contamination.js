#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt",
  ".yml",
  ".yaml"
]);
const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "tmp",
  "temp",
  ".cache",
  "dist",
  "build",
  "coverage"
]);

const PATTERNS = [
  { name: "unicode replacement character", regex: /\uFFFD/ },
  { name: "common mojibake lead bytes", regex: /(?:Ã|Â|â€|â€™|â€œ|â€\u009d|å|ä¸|æ|ç)/ },
  { name: "legacy GBK/GB2312/GB18030 charset", regex: /charset\s*=\s*["']?(?:gbk|gb2312|gb18030)/i },
  { name: "legacy non-UTF-8 decoder", regex: /\b(?:iconv|iconv-lite|TextDecoder)\s*\([^)]*["'](?:gbk|gb2312|gb18030|latin1|binary)["']/i },
  { name: "binary string conversion", regex: /\.toString\(\s*["']binary["']\s*\)/i }
];

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.isFile() && isTextFile(fullPath)) files.push(fullPath);
  }
  return files;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const findings = [];
for (const file of walk(ROOT)) {
  const relative = path.relative(ROOT, file).replace(/\\/g, "/");
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    findings.push({
      file: relative,
      line: lineNumberAt(text, match.index),
      pattern: pattern.name,
      sample: match[0]
    });
  }
}

if (findings.length) {
  console.error("Potential encoding contamination found:");
  for (const item of findings) {
    console.error(`- ${item.file}:${item.line} ${item.pattern} (${JSON.stringify(item.sample)})`);
  }
  process.exit(1);
}

console.log(`Encoding contamination scan passed (${walk(ROOT).length} text files checked).`);
