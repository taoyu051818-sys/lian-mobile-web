import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");
const GRANDFATHERED_PATH = path.join(__dirname, "motion-property-allowlist-grandfathered.json");

// Source of truth: docs/architecture/MOTION_CONTRACT_RFC_2026_05_23.md §3.2.
// New code must transition only these properties (or `transition: none` for
// reduced-motion fallbacks, which the parser filters out below). New entries
// require an RFC amendment and a doc PR.
const ALLOWED_PROPERTIES = new Set([
  "opacity",
  "transform",
  "background-color",
  "color",
  "border-color",
  "box-shadow",
]);

// Hard rule from RFC §3.2 — these reflow on the main thread and stutter on
// mobile. They MAY NOT live in the regular `files` grandfathered array;
// existing occurrences are tracked in `banned_pending_fix` (shrinks-only,
// each entry must cite a follow-up issue). The intent is that the long-tail
// fix lands in a follow-up source PR, not as a silent grandfather.
//
// Note: `filter` is NOT in this set. RFC §3.5 carves out `filter: blur()` for
// glass backdrop crossfades (≤12px delta). Treat `filter` as just "off the
// allowlist" — it is grandfatherable in the regular `files` array with a
// reason citing §3.5.
const BANNED_PROPERTIES = new Set([
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "all",
]);

// Token references that resolve to allowlist properties. The shared shorthand
// `--motion-transition` is defined in src/styles/lian-tokens.css as
// `opacity var(--motion-fast) var(--motion-ease-standard)` — already on the
// allowlist. New shorthand tokens added here must resolve to allowlist
// properties only.
const ALLOWED_TOKEN_NAMES = new Set(["--motion-transition"]);

const SCAN_EXT = new Set([".vue", ".css"]);

interface Hit {
  file: string;
  line: number;
  property: string;
  declaration: string;
}

interface GrandfatheredEntry {
  file: string;
  property: string;
  reason: string;
}

interface Grandfathered {
  files: GrandfatheredEntry[];
  banned_pending_fix: GrandfatheredEntry[];
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

/**
 * Strip <script> blocks from a Vue SFC so we don't pick up TypeScript emit
 * definitions like `transition: [reportId: string, ...]` as CSS transitions.
 * Replaced regions are rewritten to same-length whitespace so line/offset math
 * stays accurate for error messages.
 */
function stripScriptBlocks(content: string): string {
  return content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
}

/**
 * Strip /* ... *\/ block comments. Same length-preserving trick as scripts so
 * line numbers in error messages still point at the source.
 */
function stripBlockComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

/**
 * Find `transition:` declarations across one or many lines and return each
 * declaration's full value (from the colon to the terminating semicolon or
 * closing brace). The declaration may span lines because authors stack
 * properties one per line, e.g.
 *
 *   transition:
 *     transform var(--motion-standard) var(--motion-ease-overshoot),
 *     opacity   var(--motion-fast)     var(--motion-ease-standard);
 *
 * Distinguishes `transition:` from `transition-property:` /
 * `transition-duration:` / `transition-delay:` / `transition-timing-function:`
 * via the lookahead in the regex.
 */
function findTransitionDeclarations(content: string): Array<{ value: string; offset: number }> {
  const out: Array<{ value: string; offset: number }> = [];
  const re = /(^|[\s;{])transition\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const colonIdx = m.index + m[0].length - 1; // position of `:`
    let end = colonIdx + 1;
    let depth = 0;
    while (end < content.length) {
      const ch = content[end];
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === ";" || ch === "}")) break;
      end++;
    }
    const value = content.slice(colonIdx + 1, end).trim();
    out.push({ value, offset: m.index + (m[0].length - "transition:".length) });
  }
  return out;
}

/**
 * Parse a `transition:` value into the set of properties it animates.
 * Handles:
 *  - shorthand token references: `var(--motion-transition)` → `__token:--motion-transition`
 *  - reduced-motion fallback: `none` and `none !important` → empty
 *  - keyword-only values: `inherit / initial / unset / revert` → empty
 *  - comma-separated multi-property: each segment's first non-time / non-easing
 *    identifier is the property
 *  - `!important` is stripped before classification
 */
function extractProperties(value: string): string[] {
  const trimmed = value.replace(/!\s*important\b/gi, "").trim();
  if (trimmed === "" || trimmed === "none") return [];
  if (/^(inherit|initial|unset|revert)$/.test(trimmed)) return [];

  const properties: string[] = [];
  // Split by top-level commas (commas inside `var(...)` / `cubic-bezier(...)`
  // do not separate transitions).
  const segments: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of trimmed) {
    if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      buf += ch;
    } else if (ch === "," && depth === 0) {
      segments.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) segments.push(buf.trim());

  for (const seg of segments) {
    if (!seg) continue;

    // Token shorthand at the start of a segment: `var(--motion-transition)`.
    const tokenMatch = seg.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)/i);
    if (tokenMatch) {
      properties.push(`__token:${tokenMatch[1]}`);
      continue;
    }

    // Otherwise the first whitespace-separated token that is a CSS identifier
    // (not a duration, not an easing) is the property.
    const tokens = seg.split(/\s+/);
    let property: string | null = null;
    for (const t of tokens) {
      if (!t) continue;
      // Numeric durations / delays: 200ms, 0.2s, .3s.
      if (/^-?\d*\.?\d+(ms|s)$/i.test(t)) continue;
      // Bare numeric (delay) — uncommon but possible.
      if (/^-?\d*\.?\d+$/.test(t)) continue;
      // Easing keywords.
      if (/^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/i.test(t)) continue;
      // Easing functions: cubic-bezier(...), steps(...), var(--motion-ease-...).
      if (/^cubic-bezier\(/i.test(t)) continue;
      if (/^steps\(/i.test(t)) continue;
      if (/^var\(/i.test(t)) continue;
      // First identifier wins.
      property = t.toLowerCase();
      break;
    }
    if (property) properties.push(property);
  }

  return properties;
}

async function collectHits(): Promise<Hit[]> {
  const files = await walk(SRC);
  const hits: Hit[] = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    const raw = await fs.readFile(abs, "utf8");
    const cleaned = stripBlockComments(path.extname(abs) === ".vue" ? stripScriptBlocks(raw) : raw);
    for (const decl of findTransitionDeclarations(cleaned)) {
      const props = extractProperties(decl.value);
      for (const property of props) {
        hits.push({
          file: rel,
          line: lineOf(cleaned, decl.offset),
          property,
          declaration: decl.value.replace(/\s+/g, " ").trim(),
        });
      }
    }
  }
  return hits;
}

async function loadGrandfathered(): Promise<Grandfathered> {
  const raw = await fs.readFile(GRANDFATHERED_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<Grandfathered>;
  return {
    files: parsed.files ?? [],
    banned_pending_fix: parsed.banned_pending_fix ?? [],
  };
}

function isAllowed(property: string): boolean {
  if (property.startsWith("__token:")) {
    return ALLOWED_TOKEN_NAMES.has(property.slice("__token:".length));
  }
  return ALLOWED_PROPERTIES.has(property);
}

function isBanned(property: string): boolean {
  if (property.startsWith("__token:")) return false;
  return BANNED_PROPERTIES.has(property);
}

function key(file: string, property: string): string {
  return `${file}::${property}`;
}

describe("motion property allowlist (RFC §3.2)", () => {
  it("every transition property is on the allowlist or grandfathered", async () => {
    const hits = await collectHits();
    const grand = await loadGrandfathered();
    const filesSet = new Set(grand.files.map((e) => key(e.file, e.property)));
    const pendingSet = new Set(grand.banned_pending_fix.map((e) => key(e.file, e.property)));

    const violations: Hit[] = [];
    for (const h of hits) {
      if (isAllowed(h.property)) continue;
      if (filesSet.has(key(h.file, h.property))) continue;
      if (pendingSet.has(key(h.file, h.property))) continue;
      violations.push(h);
    }

    if (violations.length > 0) {
      const lines = violations
        .sort(
          (a, b) =>
            a.file.localeCompare(b.file) || a.line - b.line || a.property.localeCompare(b.property),
        )
        .map((v) => `  ${v.file}:${v.line}  transition-property: ${v.property}`);
      const message = [
        `Found ${violations.length} transition property occurrence(s) outside the §3.2 allowlist.`,
        "",
        "Either:",
        `  1) Use one of the allowlist properties: ${[...ALLOWED_PROPERTIES].join(", ")}`,
        "  2) For an unavoidable non-banned case, add an entry to the `files`",
        "     array in tests/structure/motion-property-allowlist-grandfathered.json",
        "     with a migration plan in the reason.",
        "  3) For a banned property, add to `banned_pending_fix` and open a",
        "     follow-up issue. Banned properties are tracked separately so they",
        "     cannot hide as routine grandfathers.",
        "",
        "Violations:",
        ...lines,
      ].join("\n");
      throw new Error(message);
    }
    expect(violations).toEqual([]);
  });

  it("`files` grandfathered array never covers allowlisted or banned properties", async () => {
    // Grandfathered entries that name an allowlist property are dead weight
    // (the property is already allowed everywhere). Banned-property entries
    // must live in `banned_pending_fix`, not here — keeping the two arrays
    // distinct is what stops banned violations from being silently buried.
    const grand = await loadGrandfathered();
    const offenders: Array<{ file: string; property: string; why: string }> = [];
    for (const entry of grand.files) {
      if (ALLOWED_PROPERTIES.has(entry.property)) {
        offenders.push({
          file: entry.file,
          property: entry.property,
          why: "already on the allowlist — entry is dead weight",
        });
      }
      if (BANNED_PROPERTIES.has(entry.property)) {
        offenders.push({
          file: entry.file,
          property: entry.property,
          why: "is banned by §3.2 — move to `banned_pending_fix`",
        });
      }
    }
    if (offenders.length > 0) {
      const lines = offenders.map((r) => `  ${r.file}  ${r.property}  — ${r.why}`);
      throw new Error(
        ["`files` array contains entries that should not be there:", ...lines].join("\n"),
      );
    }
    expect(offenders).toEqual([]);
  });

  it("banned properties only appear via the explicit `banned_pending_fix` tracker", async () => {
    // Hard rule: a banned property in source must either be removed or be
    // explicitly listed in `banned_pending_fix` with a follow-up issue. New
    // banned violations cannot be added to `files` (the test above blocks
    // that) and cannot be ignored (this test blocks that).
    const hits = await collectHits();
    const grand = await loadGrandfathered();
    const pendingSet = new Set(grand.banned_pending_fix.map((e) => key(e.file, e.property)));

    const banned = hits.filter(
      (h) => isBanned(h.property) && !pendingSet.has(key(h.file, h.property)),
    );

    if (banned.length > 0) {
      const lines = banned
        .sort(
          (a, b) =>
            a.file.localeCompare(b.file) || a.line - b.line || a.property.localeCompare(b.property),
        )
        .map(
          (v) =>
            `  ${v.file}:${v.line}  transition-property: ${v.property}\n      declaration: transition: ${v.declaration}`,
        );
      throw new Error(
        [
          `Found ${banned.length} unannounced banned transition property occurrence(s) (RFC §3.2).`,
          "These properties reflow or are paint-expensive on mobile. Fix the source —",
          "or, if the fix is deferred to a follow-up source PR, add an entry to",
          "`banned_pending_fix` in motion-property-allowlist-grandfathered.json",
          "with a reason citing the follow-up issue.",
          "",
          "  width / height        → use transform: scale()",
          "  top/left/right/bottom → use transform: translate()",
          "  margin / padding      → reflow trap; rework layout",
          "  all                   → enumerate the properties you actually animate",
          "",
          "Violations:",
          ...lines,
        ].join("\n"),
      );
    }
    expect(banned).toEqual([]);
  });

  it("`banned_pending_fix` only references actually-banned properties", async () => {
    // Stops drift in the other direction: `banned_pending_fix` is a vehicle
    // for tracking real banned-property debt, not a parallel grandfathered
    // bucket for any awkward case.
    const grand = await loadGrandfathered();
    const offenders = grand.banned_pending_fix.filter((e) => !BANNED_PROPERTIES.has(e.property));
    if (offenders.length > 0) {
      const lines = offenders.map(
        (e) => `  ${e.file}  ${e.property}  — not a banned property; move to \`files\``,
      );
      throw new Error(
        [
          "`banned_pending_fix` contains entries whose property is not actually banned:",
          ...lines,
        ].join("\n"),
      );
    }
    expect(offenders).toEqual([]);
  });

  it("grandfathered fixture is well-formed", async () => {
    const grand = await loadGrandfathered();
    expect(Array.isArray(grand.files)).toBe(true);
    expect(Array.isArray(grand.banned_pending_fix)).toBe(true);
    for (const arr of [grand.files, grand.banned_pending_fix]) {
      for (const entry of arr) {
        expect(typeof entry.file).toBe("string");
        expect(entry.file.length).toBeGreaterThan(0);
        expect(typeof entry.property).toBe("string");
        expect(entry.property.length).toBeGreaterThan(0);
        expect(typeof entry.reason).toBe("string");
        expect(entry.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("every grandfathered (file, property) pair is actually observed in src/", async () => {
    // Forces follow-up PRs to clean the fixture when they fix the underlying
    // source — same shrinks-only contract as state-class-grandfathered.json.
    // Applies to both `files` and `banned_pending_fix`.
    const grand = await loadGrandfathered();
    const hits = await collectHits();
    const observed = new Set(hits.map((h) => key(h.file, h.property)));
    const stale: Array<{ array: string; entry: GrandfatheredEntry }> = [];
    for (const entry of grand.files) {
      if (!observed.has(key(entry.file, entry.property))) stale.push({ array: "files", entry });
    }
    for (const entry of grand.banned_pending_fix) {
      if (!observed.has(key(entry.file, entry.property))) {
        stale.push({ array: "banned_pending_fix", entry });
      }
    }
    if (stale.length > 0) {
      const lines = stale.map(
        (s) => `  [${s.array}] ${s.entry.file}  ${s.entry.property}  (${s.entry.reason})`,
      );
      throw new Error(
        ["Grandfathered entries no longer present in src/ — remove them:", ...lines].join("\n"),
      );
    }
    expect(stale).toEqual([]);
  });
});
