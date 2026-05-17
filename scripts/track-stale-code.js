#!/usr/bin/env node
/**
 * Reports QUARANTINE: / TODO(#N): / FIXME(#N): markers in src/ and tests/,
 * with age via git blame. Output is human-readable; intended to run as a
 * manual queue review, not a hard gate.
 *
 * Run: node scripts/track-stale-code.js [--max-age-days N]
 *   --max-age-days N exits 1 if any marker is older than N days.
 *   Default is no enforcement (warn-only).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SCAN_DIRS = ["src", "tests", "docs"];
const SCAN_EXT = new Set([".ts", ".vue", ".css", ".js", ".mjs", ".md"]);
const PATTERN = /(QUARANTINE:|TODO\(#\d+\)|FIXME\(#\d+\)|TODO\b|FIXME\b)/;

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (SCAN_EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function gitBlameLine(file, lineNumber) {
  try {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const out = execFileSync(
      "git",
      ["blame", "-L", `${lineNumber},${lineNumber}`, "--porcelain", "--", rel],
      { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" },
    );
    const tsLine = out.split(/\r?\n/).find((l) => l.startsWith("author-time "));
    if (!tsLine) return null;
    const ts = Number(tsLine.split(" ")[1]);
    if (!Number.isFinite(ts)) return null;
    return ts * 1000;
  } catch {
    return null;
  }
}

function ageDays(epochMs) {
  if (epochMs == null) return null;
  return Math.floor((Date.now() - epochMs) / (1000 * 60 * 60 * 24));
}

async function main() {
  const args = process.argv.slice(2);
  const maxAgeIdx = args.indexOf("--max-age-days");
  const maxAge = maxAgeIdx >= 0 ? Number(args[maxAgeIdx + 1]) : null;

  const files = [];
  for (const d of SCAN_DIRS) files.push(...(await walk(path.join(ROOT, d))));

  const findings = [];
  for (const f of files) {
    let content;
    try {
      content = await fs.readFile(f, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(PATTERN);
      if (!m) continue;
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      const blameAt = gitBlameLine(f, i + 1);
      findings.push({
        file: rel,
        line: i + 1,
        marker: m[1],
        text: lines[i].trim().slice(0, 140),
        ageDays: ageDays(blameAt),
      });
    }
  }

  findings.sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));

  console.log(`[stale-code] ${findings.length} markers across ${files.length} scanned files\n`);
  const buckets = { "QUARANTINE:": [], "TODO(#": [], "FIXME(#": [], TODO: [], FIXME: [] };
  for (const f of findings) {
    const key = f.marker.startsWith("QUARANTINE")
      ? "QUARANTINE:"
      : f.marker.startsWith("TODO(#")
        ? "TODO(#"
        : f.marker.startsWith("FIXME(#")
          ? "FIXME(#"
          : f.marker;
    buckets[key].push(f);
  }
  for (const [name, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    console.log(`## ${name} (${list.length})`);
    for (const f of list.slice(0, 50)) {
      const age = f.ageDays != null ? `${f.ageDays}d` : "?";
      console.log(`  ${age.padStart(5)}  ${f.file}:${f.line}  ${f.text}`);
    }
    if (list.length > 50) console.log(`  ... and ${list.length - 50} more`);
    console.log();
  }

  if (maxAge != null && Number.isFinite(maxAge)) {
    const overaged = findings.filter((f) => f.ageDays != null && f.ageDays > maxAge);
    if (overaged.length) {
      console.error(`[stale-code] ${overaged.length} markers exceed --max-age-days=${maxAge}`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
