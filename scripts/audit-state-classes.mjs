#!/usr/bin/env node
/**
 * Audit `.is-*` state-class usage across `src/**\/*.{vue,css}`.
 *
 * Prints every occurrence (file, line, class name) and a per-class summary so
 * we can see which state classes are widely used, which are one-offs, and which
 * are good candidates for renaming into the shared white-list defined by
 * `docs/frontend/state-vocabulary.md`.
 *
 * This script is exploratory — it does NOT fail. The lint guard lives in
 * `tests/structure/state-class-vocabulary.test.ts` (vitest) and reads the same
 * white-list + grandfathered JSON.
 *
 * Run: node scripts/audit-state-classes.mjs [--json]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

// Patterns:
//   \.is-foo        — CSS selector (*.css and <style> inside *.vue)
//   'is-foo'        — class string in :class={...} or :class=[...] template binding
//   "is-foo"        — class string in :class=[...] template binding (double-quoted variant)
//   class="...is-foo..." — static class attribute (Vue template, plain HTML)
//
// Deliberately NOT matched:
//   :is-foo="..."   — Vue prop binding on a child component (kebab-case prop names)
//   <Foo is-foo />  — also a prop alias; only matched when wrapped in quotes as a class string
const CSS_PATTERN = /\.(is-[a-z][a-z0-9-]*)\b/g;
const QUOTED_PATTERN = /['"](is-[a-z][a-z0-9-]*)['"]/g;
// Match `class="..."` but NOT `:class="..."`, `v-bind:class="..."`, or `<Foo :is-foo="..." />`.
const STATIC_CLASS_PATTERN = /(?<![:@\w-])class\s*=\s*"([^"]*)"/g;
const BARE_STATE_PATTERN = /\b(is-[a-z][a-z0-9-]*)\b/g;

const SCAN_EXT = new Set([".vue", ".css"]);

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (SCAN_EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function lineOf(content, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * @returns {Array<{ file: string, line: number, name: string, source: string }>}
 */
export async function collectStateClassUsages(srcRoot = SRC) {
  const files = await walk(srcRoot);
  const hits = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    const content = await fs.readFile(abs, "utf8");

    // 1) CSS selectors `.is-foo`
    for (const m of content.matchAll(CSS_PATTERN)) {
      hits.push({
        file: rel,
        line: lineOf(content, m.index ?? 0),
        name: m[1],
        source: "css",
      });
    }

    // 2) Quoted class strings `'is-foo'` / `"is-foo"`
    for (const m of content.matchAll(QUOTED_PATTERN)) {
      hits.push({
        file: rel,
        line: lineOf(content, m.index ?? 0),
        name: m[1],
        source: "binding",
      });
    }

    // 3) Static `class="...is-foo..."` attributes — only inside Vue templates
    if (path.extname(abs) === ".vue") {
      for (const attr of content.matchAll(STATIC_CLASS_PATTERN)) {
        const inner = attr[1];
        const attrStart = attr.index ?? 0;
        for (const w of inner.matchAll(BARE_STATE_PATTERN)) {
          hits.push({
            file: rel,
            line: lineOf(content, attrStart + (w.index ?? 0)),
            name: w[1],
            source: "static-attr",
          });
        }
      }
    }
  }
  return hits;
}

function summarise(hits) {
  const byClass = new Map();
  for (const h of hits) {
    if (!byClass.has(h.name)) byClass.set(h.name, { count: 0, files: new Set() });
    const entry = byClass.get(h.name);
    entry.count += 1;
    entry.files.add(h.file);
  }
  return [...byClass.entries()]
    .map(([name, { count, files }]) => ({ name, count, files: [...files].sort() }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function main() {
  const wantJson = process.argv.includes("--json");
  const hits = await collectStateClassUsages();
  const summary = summarise(hits);

  if (wantJson) {
    process.stdout.write(JSON.stringify({ totalHits: hits.length, summary, hits }, null, 2));
    process.stdout.write("\n");
    return;
  }

  console.log(`Scanned src/**/*.{vue,css}; found ${hits.length} \`.is-*\` occurrences`);
  console.log(`Distinct state classes: ${summary.length}\n`);
  console.log("name                   count  files");
  console.log("---------------------- -----  -----");
  for (const row of summary) {
    const name = row.name.padEnd(22);
    const count = String(row.count).padStart(5);
    console.log(`${name} ${count}  ${row.files.length}`);
  }
  console.log("");
  console.log("Per-occurrence (file:line  name  source):");
  for (const h of hits.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name),
  )) {
    console.log(`  ${h.file}:${h.line}  ${h.name}  (${h.source})`);
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("audit-state-classes.mjs")
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
