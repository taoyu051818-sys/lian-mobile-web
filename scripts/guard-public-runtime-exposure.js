#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const textExtensions = new Set([".html", ".js", ".css", ".ts", ".vue", ".json", ".md", ".map"]);

const productionEntryFiles = ["index.html", "src/main.ts", "src/App.vue", "vite.config.ts"];

const productionEntryDirectories = ["public", "dist"];

const ignoredPrefixes = ["public/tools/"];

const harmlessSecretValues = new Set([
  "example",
  "example.com",
  "placeholder",
  "replace-me",
  "test",
  "todo",
  "your-api-key",
  "your-secret",
  "your-token",
]);

const secretIdentifierPattern = String.raw`(?:NODEBB_API_TOKEN|MIMO_API_KEY|CLOUDINARY_URL|ADMIN_TOKEN|SERVERCHAN|sendKey|CLIENT_SECRET|PRIVATE_KEY|BEARER_TOKEN|apiKey|secret|token|password)`;

const secretAssignmentPattern = new RegExp(
  String.raw`(?:(\b${secretIdentifierPattern}\b)\s*[:=]\s*\\?(["'\`])([^"'\`\n]+)\\?\2|["'\`](${secretIdentifierPattern})["'\`]\s*:\s*\\?(["'\`])([^"'\`\n]+)\\?\5)`,
  "gi",
);

const rawSecretLikeValuePattern =
  /(?:cloudinary:\/\/[^"'`\s<>]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/gi;
const publicEnvSecretReferencePattern =
  /\bimport\.meta\.env\.(?:VITE_|PUBLIC_)?[A-Z0-9_]*(?:NODEBB_API_TOKEN|MIMO_API_KEY|CLOUDINARY_URL|ADMIN_TOKEN|SERVERCHAN|SENDKEY|API_KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*/g;

const forbiddenChecks = [
  {
    name: "rehearsal marker",
    pattern: /\bLIAN_STATIC_REHEARSAL\b/g,
  },
  {
    name: "internal/debug path",
    pattern:
      /["'`](?:\/(?:debug|internal|admin)(?:\/|["'`?#])|\/tools\/(?:debug|internal|admin|ops|qa|dev)(?:[/.][^"'`?#]*)?["'`?#])/g,
  },
  {
    name: "broad API runtime cache",
    pattern:
      /urlPattern\s*:\s*(?:\/\^https\?:\\\/\\\/\[\^\/\]\+\\\/api\\\/|\/\^\\\/api\\\/|new\s+RegExp\(\s*["'`]\^?(?:\\\/|\/)api(?:\\\/|\/))/g,
  },
  {
    name: "API runtime cache name",
    pattern: /cacheName\s*:\s*["'`]api-cache["'`]/g,
  },
  {
    name: "secret-like runtime exposure",
    findMatches: findSecretLikeMatches,
  },
];

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  ✗ ${label} — ${reason}`);
}

function repoPath(...parts) {
  return path.join(rootDir, ...parts);
}

function normalizeRelative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function shouldIgnore(relativePath) {
  return ignoredPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function walkFiles(relativeDir, files = []) {
  const dirPath = repoPath(relativeDir);
  if (!fs.existsSync(dirPath)) return files;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = normalizeRelative(fullPath);
    if (entry.isDirectory()) {
      walkFiles(relativePath, files);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name))) continue;
    if (shouldIgnore(relativePath)) continue;
    files.push(relativePath);
  }
  return files;
}

function defaultTargets() {
  const targets = new Set();
  for (const file of productionEntryFiles) {
    if (fs.existsSync(repoPath(file))) targets.add(file);
  }
  for (const dir of productionEntryDirectories) {
    for (const file of walkFiles(dir)) targets.add(file);
  }
  return Array.from(targets).sort();
}

function expandTarget(target) {
  const fullPath = path.resolve(process.cwd(), target);
  if (!fs.existsSync(fullPath)) return [];
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    return walkFiles(path.relative(rootDir, fullPath));
  }
  const relativePath = normalizeRelative(fullPath);
  if (shouldIgnore(relativePath)) return [];
  if (!textExtensions.has(path.extname(relativePath))) return [];
  return [relativePath];
}

function isHarmlessSecretValue(value, relativePath) {
  const isHarmlessContext = relativePath.startsWith("docs/") || relativePath.includes("test");
  return isHarmlessContext && harmlessSecretValues.has(value.trim().toLowerCase());
}

function findSecretLikeMatches(text, relativePath) {
  const matches = [];
  rawSecretLikeValuePattern.lastIndex = 0;
  let rawMatch;
  while ((rawMatch = rawSecretLikeValuePattern.exec(text)) !== null) {
    matches.push(rawMatch[0]);
    if (matches.length >= 3) return matches;
  }

  publicEnvSecretReferencePattern.lastIndex = 0;
  let envMatch;
  while ((envMatch = publicEnvSecretReferencePattern.exec(text)) !== null) {
    matches.push(envMatch[0]);
    if (matches.length >= 3) return matches;
  }

  secretAssignmentPattern.lastIndex = 0;
  let assignmentMatch;
  while ((assignmentMatch = secretAssignmentPattern.exec(text)) !== null) {
    const value = assignmentMatch[3] || assignmentMatch[6] || "";
    if (!isHarmlessSecretValue(value, relativePath)) {
      matches.push(assignmentMatch[0]);
      if (matches.length >= 3) break;
    }
  }
  secretAssignmentPattern.lastIndex = 0;
  return matches;
}

function findMatches(text, check, relativePath) {
  if (check.findMatches) return check.findMatches(text, relativePath);
  check.pattern.lastIndex = 0;
  const matches = [];
  let match;
  while ((match = check.pattern.exec(text)) !== null) {
    matches.push(match[0]);
    if (matches.length >= 3) break;
  }
  check.pattern.lastIndex = 0;
  return matches;
}

function checkFile(relativePath) {
  const fullPath = repoPath(relativePath);
  let text;
  try {
    text = fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    fail(relativePath, error.message || "file read failed");
    return;
  }

  const violations = [];
  for (const check of forbiddenChecks) {
    const matches = findMatches(text, check, relativePath);
    if (matches.length) {
      violations.push(`${check.name}: ${matches.join(", ")}`);
    }
  }

  if (violations.length) {
    fail(relativePath, violations.join(" | "));
    return;
  }

  ok(relativePath);
}

const requestedTargets = process.argv.slice(2);
const targets = requestedTargets.length
  ? Array.from(new Set(requestedTargets.flatMap(expandTarget))).sort()
  : defaultTargets();

console.log("\n═══ LIAN public runtime exposure guard ═══\n");

if (!targets.length) {
  fail("guard target discovery", "no production-facing files found");
} else {
  for (const target of targets) checkFile(target);
}

console.log(`\n═══ Result: ${passed} passed, ${failed} failed ═══\n`);

if (failed > 0) process.exit(1);
