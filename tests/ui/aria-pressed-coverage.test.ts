import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Apple Music gap analysis — PR-β (aria-pressed coverage).
 *
 * Apple Music's web album page peppers ~24 paired aria-pressed=true/false
 * states across its toggle buttons (play, like, save, follow…) so screen
 * readers announce "Pressed" / "Not pressed". LIAN historically only
 * exposed the visible label, leaving SR users without that toggle state.
 *
 * Two guards live here:
 *
 *  1. POSITIVE (whitelist) — every known toggle button must declare
 *     :aria-pressed (or aria-pressed) in the SFC source. The whitelist
 *     names the exact file + a textual marker that anchors the assertion
 *     to the correct button when a file has multiple buttons.
 *
 *  2. NEGATIVE (regression) — scan all SFCs for buttons that label
 *     themselves with toggle-state phrases ("已喜欢" / "已收藏" / etc.)
 *     and require the same SFC to use aria-pressed somewhere. This is
 *     a "smoke" guard: it fires when a new toggle button gets added
 *     with a stateful Chinese label but the engineer forgot the ARIA.
 *
 * Out of scope (intentionally NOT enforced here):
 *   - segmented controls / tab switchers — those should use role="tab"
 *     + aria-selected (Apple's pattern). Some current LIAN tabs are
 *     mismatched; flagged in the PR body, not auto-fixed in this PR.
 *   - aria-expanded disclosures (admin queue item, place sheet pill).
 *   - native <input type="checkbox"> toggles in profile settings — the
 *     checkbox role already exposes "checked" to SRs.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const srcRoot = path.join(repoRoot, "src");

function readSfc(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8").replace(/\r\n/g, "\n");
}

function walkVue(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walkVue(full, out);
    } else if (entry.endsWith(".vue")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Toggle whitelist: each entry pins a single toggle button.
 *
 * `marker` is a string we expect to find in the SFC source (typically the
 * @click handler or the aria-label expression) — we then require an
 * aria-pressed attribute to live within the surrounding <button> element.
 *
 * Add a new row here whenever a new toggle button ships. Removing a row
 * means the button is no longer a toggle (rename / removal).
 */
const TOGGLE_BUTTON_WHITELIST: Array<{
  file: string;
  description: string;
  marker: RegExp;
}> = [
  {
    file: "src/features/feed/FeedItemCardFooter.vue",
    description: "feed card like button",
    marker: /@click\.stop="handleLike"/,
  },
  {
    file: "src/features/detail/PostReplyDock.vue",
    description: "detail dock like button",
    marker: /@click="emit\('like'\)"/,
  },
  {
    file: "src/features/detail/PostReplyDock.vue",
    description: "detail dock save button",
    marker: /@click="emit\('save'\)"/,
  },
  {
    file: "src/features/auth/AuthInterestPicker.vue",
    description: "auth onboarding interest chip",
    marker: /@click="\$emit\('toggle', interest\.id\)"/,
  },
  {
    file: "src/shell/ShellChrome.vue",
    description: "shell-chrome filter chip",
    marker: /@click="handleFilterToggle\(f\.id\)"/,
  },
  {
    file: "src/features/admin/AdminQueueList.vue",
    description: "admin queue status filter",
    marker: /@click="emit\('filterChange', opt\.value\)"/,
  },
  {
    file: "src/features/admin/AdminView.vue",
    description: "admin verification status filter",
    marker: /@click="handleVerificationFilterChange\(opt\.value\)"/,
  },
  {
    // Apple-gap PR-δ: LianButton's optional 6-state vocabulary lets
    // callers opt into toggle semantics via state="pressed". The base
    // primitive declares :aria-pressed conditionally — this row pins
    // that the SFC still owns the binding so the vocabulary cannot
    // regress to a plain button without aria.
    file: "src/ui/LianButton.vue",
    description: "shared button pressed-state binding",
    marker: /@click="handleClick"/,
  },
];

/**
 * Find the <button …> opening tag that contains `marker` and return its
 * full opening-tag text (everything from the `<button` up to the
 * matching `>`). Returns null if not found.
 */
function findEnclosingButton(source: string, marker: RegExp): string | null {
  const match = marker.exec(source);
  if (!match) return null;
  const idx = match.index;
  // Walk backwards to find the nearest `<button` that opens this element.
  const before = source.slice(0, idx);
  const openIdx = before.lastIndexOf("<button");
  if (openIdx === -1) return null;
  // Walk forward from openIdx to find the closing `>` of the opening tag.
  const after = source.slice(openIdx);
  // Stop at the first unquoted `>` — Vue templates do not nest `<` inside
  // attribute values, so a naive scan is good enough here.
  let depth = 0;
  for (let i = 0; i < after.length; i++) {
    const ch = after[i];
    if (ch === '"' || ch === "'") {
      // Skip the entire quoted attribute value.
      const quote = ch;
      i++;
      while (i < after.length && after[i] !== quote) i++;
      continue;
    }
    if (ch === "<") depth++;
    if (ch === ">") {
      depth--;
      if (depth === 0) {
        return after.slice(0, i + 1);
      }
    }
  }
  return null;
}

describe("aria-pressed coverage on toggle buttons (Apple gap PR-β)", () => {
  describe.each(TOGGLE_BUTTON_WHITELIST)("$file — $description", ({ file, marker }) => {
    const source = readSfc(file);

    it("the marker resolves to a single <button> opening tag", () => {
      const tag = findEnclosingButton(source, marker);
      expect(tag, `marker ${marker} did not resolve in ${file}`).not.toBeNull();
      expect(tag!.startsWith("<button"), `marker ${marker} did not open <button`).toBe(true);
    });

    it("declares aria-pressed bound to a stateful expression", () => {
      const tag = findEnclosingButton(source, marker);
      expect(tag).not.toBeNull();
      // `:aria-pressed="..."` (preferred) or `aria-pressed="..."` literal.
      expect(tag!).toMatch(/\s:?aria-pressed="[^"]+"/);
    });
  });
});

describe("aria-pressed regression scan over all SFCs", () => {
  // Phrases that appear inside conditional Chinese labels for toggle
  // buttons. These are stateful — they read out the "after-press" name.
  // If we see them in a SFC, we expect aria-pressed to appear in the
  // same SFC. Cancel-style phrases ("取消…") trigger the same require.
  const TOGGLE_LABEL_PHRASES = [
    "已喜欢",
    "已收藏",
    "已点赞",
    "已订阅",
    "已关注",
    "已选中",
    "已开启",
    "已置顶",
    "已收听",
    "取消喜欢",
    "取消点赞",
    "取消收藏",
    "取消关注",
    "取消订阅",
    "取消屏蔽",
  ];

  // Files we deliberately exclude — these phrases appear in non-toggle
  // contexts (status badges, descriptive text in serverchan/profile blocks
  // where the actual control is a native checkbox or a confirm dialog).
  const NON_TOGGLE_BUTTON_FILES = new Set([
    // ServerChan: "已绑定但已停用" is a status label (not a button); the
    // toggles on this surface are native <input type="checkbox">.
    "src/features/profile/ProfileServerChanBlock.vue",
    // Profile activity status pill: "已发布" is a published badge, not a
    // toggle.
    "src/features/profile/ProfileCollectionList.vue",
  ]);

  const ALL_SFCS = walkVue(srcRoot).map((p) => path.relative(repoRoot, p).replace(/\\/g, "/"));

  it("every toggle-labelled SFC also declares aria-pressed somewhere", () => {
    const offenders: Array<{ file: string; phrase: string }> = [];
    for (const relative of ALL_SFCS) {
      if (NON_TOGGLE_BUTTON_FILES.has(relative)) continue;
      const source = readSfc(relative);
      // Cheap heuristic: only require aria-pressed when the SFC contains
      // both a <button> and one of the toggle phrases inside a button-ish
      // template region. We don't parse — we just scan.
      if (!source.includes("<button")) continue;
      for (const phrase of TOGGLE_LABEL_PHRASES) {
        if (!source.includes(phrase)) continue;
        if (!/\s:?aria-pressed="/.test(source)) {
          offenders.push({ file: relative, phrase });
          break;
        }
      }
    }
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });

  it("the whitelist covers every SFC that uses :aria-pressed on a button", () => {
    // This guard catches "ghost" aria-pressed usages — a button gets
    // aria-pressed added in some refactor but is missing from the
    // whitelist, so the per-button assertion above doesn't run on it.
    // We scan for aria-pressed and require the file path to be in the
    // whitelist.
    const whitelistFiles = new Set(TOGGLE_BUTTON_WHITELIST.map((row) => row.file));
    const ghostFiles: string[] = [];
    for (const relative of ALL_SFCS) {
      const source = readSfc(relative);
      if (!/\s:?aria-pressed="/.test(source)) continue;
      if (!whitelistFiles.has(relative)) ghostFiles.push(relative);
    }
    expect(ghostFiles, JSON.stringify(ghostFiles, null, 2)).toEqual([]);
  });
});
