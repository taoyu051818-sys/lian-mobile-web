#!/usr/bin/env node
/**
 * check-view-imports-composable.mjs
 *
 * View → composable → api boundary guard (issue #758).
 *
 * Why: the three-layer contract (view depends on composable, composable
 * depends on api) is the seam that lets us mock/unit-test composables and
 * collect retry/cache/auth concerns in one place. Views that reach straight
 * into `src/api/*` bypass that seam and erode testability. This guard
 * stops new violations from landing while a follow-up to issue #500 cleans
 * up the existing legacy entries listed in the allowlist.
 *
 * What is a violation:
 *   Any <script> block inside any .vue file under src/features/ whose source
 *   contains a static `from "<path>"` import where <path> resolves to the api
 *   layer. We match these path shapes:
 *     - (../)+api/...        relative escape into src/api
 *     - @/api/...            ts-config alias (not configured today, but
 *                            we still ban it so future drift cannot slip in)
 *     - src/api/...          bare `src/...` rooted import
 *     - ~/api/...            vite alias `~` -> `src` (see vite.config.ts)
 *
 *   composable -> api is allowed (composables live in src/composables/ or
 *   src/features/<feature>/use*.ts and are not scanned by this guard).
 *   view -> composable and view -> utils are allowed (this guard does not
 *   look at non-api paths).
 *
 * Allowlist semantics (`scripts/check-view-imports-composable.allow.txt`):
 *   One repo-relative path per line. Lines starting with `#` and blank lines
 *   are ignored. Files listed there may keep their existing direct-api
 *   imports; the guard prints a `[warn]` line for each but does NOT fail.
 *   New violations (anything not on the allowlist) cause a non-zero exit.
 *   The list is the registry of legacy debt; gradual cleanup is tracked
 *   under issue #500.
 *
 * Why npm run check:
 *   Wired into `npm run check` so PR CI catches new bypasses at the same
 *   gate as the other structural guards (validate-project-structure,
 *   guard-unsafe-dom-sinks, etc.). Failure prints `<file>:<line>: <import>`
 *   so the offender can be located without grepping.
 *
 * Test override:
 *   `LIAN_VIEW_BOUNDARY_ROOT=<path>` overrides the repo root the guard
 *   scans. Used by tests/scripts/check-view-imports-composable.test.ts to
 *   run the real script against fixture trees without polluting the repo.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const ROOT_DIR = process.env.LIAN_VIEW_BOUNDARY_ROOT
  ? path.resolve(process.env.LIAN_VIEW_BOUNDARY_ROOT)
  : DEFAULT_ROOT;
const FEATURES_DIR = path.join(ROOT_DIR, "src", "features");
const ALLOWLIST_FILE = path.join(ROOT_DIR, "scripts", "check-view-imports-composable.allow.txt");

// Forbidden import-path shapes. Capture group 1 is the api-prefix portion;
// the rest of the import path follows. Anchored on `from "..."` / `from '...'`
// so we ignore string literals that just happen to look like paths.
const FORBIDDEN_IMPORT_RE =
  /from\s+["']((?:\.\.\/)+api\/|@\/api\/|src\/api\/|~\/api\/)[^"']*["']/g;

// Match a single <script ...>...</script> block (script setup or plain).
// Vue SFCs may have at most two script blocks (one regular, one setup);
// both are scanned.
const SCRIPT_BLOCK_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

function toRepoRelative(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath).replace(/\\/g, "/");
}

function walkVueFiles(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return files;
    throw err;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkVueFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".vue")) {
      files.push(fullPath);
    }
  }
  return files;
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_FILE)) return new Set();
  const lines = fs.readFileSync(ALLOWLIST_FILE, "utf8").split(/\r?\n/);
  const entries = new Set();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    entries.add(line.replace(/\\/g, "/"));
  }
  return entries;
}

function lineNumberAt(text, offset) {
  // 1-based line number of the character at `offset`.
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

function scanFile(absolutePath) {
  const content = fs.readFileSync(absolutePath, "utf8");
  const findings = [];
  SCRIPT_BLOCK_RE.lastIndex = 0;
  let scriptMatch;
  while ((scriptMatch = SCRIPT_BLOCK_RE.exec(content)) !== null) {
    const openTagEnd = scriptMatch.index + scriptMatch[0].indexOf(">") + 1;
    const blockText = scriptMatch[1];
    FORBIDDEN_IMPORT_RE.lastIndex = 0;
    let importMatch;
    while ((importMatch = FORBIDDEN_IMPORT_RE.exec(blockText)) !== null) {
      const absoluteOffset = openTagEnd + importMatch.index;
      const line = lineNumberAt(content, absoluteOffset);
      // The literal between the quotes — used only for human-readable output.
      const importPath = importMatch[0]
        .replace(/^from\s+["']/, "")
        .replace(/["']$/, "");
      findings.push({ line, importPath });
    }
  }
  return findings;
}

function main() {
  const allowlist = loadAllowlist();
  const vueFiles = walkVueFiles(FEATURES_DIR);

  /** @type {Array<{file: string, line: number, importPath: string}>} */
  const violations = [];
  /** @type {Array<{file: string, line: number, importPath: string}>} */
  const warnings = [];

  for (const absolutePath of vueFiles) {
    const findings = scanFile(absolutePath);
    if (findings.length === 0) continue;
    const relative = toRepoRelative(absolutePath);
    const target = allowlist.has(relative) ? warnings : violations;
    for (const finding of findings) {
      target.push({ file: relative, ...finding });
    }
  }

  if (violations.length > 0) {
    console.error("check-view-imports-composable: new violations detected.");
    console.error(
      "  Views under src/features must depend on composables, not on src/api/* directly.",
    );
    console.error("  Move the api call into a use* composable and import that from the view.");
    console.error("");
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}: ${v.importPath}`);
    }
    if (warnings.length > 0) {
      console.error("");
      console.error(`Allowlisted legacy entries (issue #500 follow-up): ${warnings.length}`);
      for (const w of warnings) {
        console.error(`  [warn] ${w.file}:${w.line}: ${w.importPath}`);
      }
    }
    console.error("");
    console.error(
      `Result: ${violations.length} violation(s), ${warnings.length} allowlisted warning(s).`,
    );
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log("check-view-imports-composable: no new violations.");
    console.log(
      `Allowlisted legacy entries (issue #500 follow-up): ${warnings.length}`,
    );
    for (const w of warnings) {
      console.log(`  [warn] ${w.file}:${w.line}: ${w.importPath}`);
    }
    console.log("");
    console.log(
      `Result: 0 violation(s), ${warnings.length} allowlisted warning(s) across ${vueFiles.length} view(s).`,
    );
  } else {
    console.log(
      `check-view-imports-composable: 0 violation(s), 0 allowlisted warning(s) across ${vueFiles.length} view(s).`,
    );
  }
}

main();
