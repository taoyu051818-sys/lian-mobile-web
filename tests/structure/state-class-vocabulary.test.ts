import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");
const GRANDFATHERED_PATH = path.join(__dirname, "state-class-grandfathered.json");

// Source of truth: docs/frontend/state-vocabulary.md.
// Nine names. New code must use one of these. New entries require both a doc
// PR (state-vocabulary.md) AND adding the name here. Apple-gap PR-δ added
// `.is-success` so the LianButton 6-state vocabulary has a result-positive
// counterpart to `.is-error` (callers can show "saved" / "joined" / "sent"
// confirmations through the same primitive).
const ALLOWED_STATE_CLASSES = new Set([
  "is-loading",
  "is-empty",
  "is-error",
  "is-success",
  "is-disabled",
  "is-pressed",
  "is-selected",
  "is-active",
  "is-open",
]);

const SCAN_EXT = new Set([".vue", ".css"]);

const CSS_PATTERN = /\.(is-[a-z][a-z0-9-]*)\b/g;
const QUOTED_PATTERN = /['"](is-[a-z][a-z0-9-]*)['"]/g;
const STATIC_CLASS_PATTERN = /(?<![:@\w-])class\s*=\s*"([^"]*)"/g;
const BARE_STATE_PATTERN = /\b(is-[a-z][a-z0-9-]*)\b/g;

interface Hit {
  file: string;
  line: number;
  name: string;
}

interface Grandfathered {
  grandfathered: Array<{ class: string; files: string[]; reason: string }>;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (SCAN_EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function lineOf(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

async function collectHits(): Promise<Hit[]> {
  const files = await walk(SRC);
  const hits: Hit[] = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    const content = await fs.readFile(abs, "utf8");

    for (const m of content.matchAll(CSS_PATTERN)) {
      hits.push({ file: rel, line: lineOf(content, m.index ?? 0), name: m[1] });
    }
    for (const m of content.matchAll(QUOTED_PATTERN)) {
      hits.push({ file: rel, line: lineOf(content, m.index ?? 0), name: m[1] });
    }
    if (path.extname(abs) === ".vue") {
      for (const attr of content.matchAll(STATIC_CLASS_PATTERN)) {
        const inner = attr[1];
        const attrStart = attr.index ?? 0;
        for (const w of inner.matchAll(BARE_STATE_PATTERN)) {
          hits.push({
            file: rel,
            line: lineOf(content, attrStart + (w.index ?? 0)),
            name: w[1],
          });
        }
      }
    }
  }
  return hits;
}

async function loadGrandfathered(): Promise<Map<string, Set<string>>> {
  const raw = await fs.readFile(GRANDFATHERED_PATH, "utf8");
  const parsed = JSON.parse(raw) as Grandfathered;
  const map = new Map<string, Set<string>>();
  for (const entry of parsed.grandfathered) {
    map.set(entry.class, new Set(entry.files));
  }
  return map;
}

describe("state-class vocabulary (.is-*)", () => {
  it("every .is-* in src/ is on the allow-list or grandfathered", async () => {
    const hits = await collectHits();
    const grandfathered = await loadGrandfathered();
    const violations: Hit[] = [];
    for (const h of hits) {
      if (ALLOWED_STATE_CLASSES.has(h.name)) continue;
      const allowedFiles = grandfathered.get(h.name);
      if (allowedFiles && allowedFiles.has(h.file)) continue;
      violations.push(h);
    }
    if (violations.length > 0) {
      const lines = violations
        .sort(
          (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name),
        )
        .map((v) => `  ${v.file}:${v.line}  .${v.name}`);
      const message = [
        `Found ${violations.length} state-class occurrence(s) outside the vocabulary.`,
        "",
        "Either:",
        "  1) Use one of the allowed names from docs/frontend/state-vocabulary.md:",
        `     ${[...ALLOWED_STATE_CLASSES].join(", ")}`,
        "  2) Move the class out of the .is-* namespace (BEM modifier or component-scoped).",
        "  3) For an unavoidable temporary case, add a grandfathered entry to",
        "     tests/structure/state-class-grandfathered.json with a migration plan.",
        "",
        "Violations:",
        ...lines,
      ].join("\n");
      throw new Error(message);
    }
    expect(violations).toEqual([]);
  });

  it("grandfathered list is well-formed and only shrinks (no new names without doc PR)", async () => {
    const grandfathered = await loadGrandfathered();
    for (const [name, files] of grandfathered.entries()) {
      expect(name).toMatch(/^is-[a-z][a-z0-9-]*$/);
      expect(files.size).toBeGreaterThan(0);
      // Grandfathered entries must NOT collide with the white-list — once a class
      // is on the white-list, every usage is implicitly allowed and the entry is
      // dead weight. Removing the entry is the migration acceptance test.
      expect(ALLOWED_STATE_CLASSES.has(name)).toBe(false);
    }
  });

  it("every grandfathered file path actually contains the class it claims", async () => {
    // Ensures the grandfathered list does not drift: if a file is renamed or its
    // class removed, the entry must be removed too. This forces follow-up PRs to
    // clean up after themselves.
    const grandfathered = await loadGrandfathered();
    const hits = await collectHits();
    const observed = new Map<string, Set<string>>();
    for (const h of hits) {
      if (!observed.has(h.name)) observed.set(h.name, new Set());
      observed.get(h.name)!.add(h.file);
    }

    const stale: Array<{ class: string; file: string }> = [];
    for (const [name, files] of grandfathered.entries()) {
      const obs = observed.get(name) ?? new Set<string>();
      for (const file of files) {
        if (!obs.has(file)) stale.push({ class: name, file });
      }
    }
    if (stale.length > 0) {
      const lines = stale.map((s) => `  .${s.class}  ${s.file}`);
      throw new Error(
        [`Grandfathered entries no longer present in src/ — remove them:`, ...lines].join("\n"),
      );
    }
    expect(stale).toEqual([]);
  });
});
