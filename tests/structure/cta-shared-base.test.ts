/**
 * cta-shared-base structure test (Apple-gap wave 3-A / mw#827).
 *
 * Locks two invariants:
 *
 *   1. Every detail-page CTA derives from the shared `LianButton` /
 *      `DetailCtaButton` base. A detail block that grows a bare
 *      `<button>` for a primary action is a regression — the shared 6-state
 *      vocabulary is what stops the "looks clickable, isn't" bug surface
 *      from coming back. A grandfathered allowlist tolerates the existing
 *      exceptions (gallery thumb, top-bar close button, reply dock IME
 *      controls — these are not primary CTAs) until they migrate.
 *
 *   2. No `.vue` file in the detail surface uses `transition: all`. The
 *      motion-property-allowlist test owns the global rule, but we keep
 *      a focused detail-page check here so a new detail block can't
 *      sneak `transition: all` past code review.
 *
 * Runs as a vitest source-text contract — same convention as the other
 * structure tests in the repo.
 */
import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const detailDir = path.join(repoRoot, "src", "features", "detail");

/**
 * Files that contain a `<button>` for a non-primary purpose (gallery
 * thumb, top-bar dismiss, etc.) and are explicitly NOT covered by the
 * 6-state CTA vocabulary. Each entry pins the file + the reason. Adding
 * a new entry here requires the reviewer to confirm the button is not a
 * primary CTA — for primary CTAs the right answer is to migrate to
 * `DetailCtaButton`.
 */
const GRANDFATHERED_BARE_BUTTONS: Record<string, string> = {
  "PostDetailGallery.vue": "image thumb tile — not a primary CTA, no 6-state surface needed",
  "PostDetailInfoStrip.vue":
    "info chip dismiss + place-sheet open — affordances on a metadata strip, not a primary CTA",
  "PostDetailPanel.vue":
    "loading-error retry button — temporary, will fold into the 6-state CTA surface in the wave 3-B follow-up",
  "PostDetailHelpManageBlock.vue":
    "author-side manage controls — covered by the wave 3-B trade/help CTA migration (mw#827 PR-3)",
  "PostReplyDock.vue":
    "reply composer mode toggles + send — IME-bound surface, owns its own state vocabulary (#130)",
  "PostDetailHelpBlock.vue":
    "vote / cancel-vote helper actions — covered by the wave 3-B trade/help CTA migration (mw#827 PR-3)",
  "PostDetailTradeManageBlock.vue":
    "trade transition matrix — covered by the wave 3-B trade/help CTA migration (mw#827 PR-3)",
  "PostDetailEventBlock.vue":
    "event join / cancel / complete — covered by the wave 3-B event CTA migration (#827 PR-2)",
  "PostPlaceSheetBlock.vue":
    "place sheet retry / dismiss — affordances inside a sheet, not a primary CTA",
  "PostDetailTopbar.vue": "topbar dismiss + share — chrome controls, not a primary CTA",
  "PostDetailTypedFallbackBlock.vue":
    "typed-fallback explicit blocked-action button — already disabled-state-only, no live state machine",
  "ShareCardSheet.vue": "share card retry — affordance inside a sheet, not a primary CTA",
};

async function read(rel: string): Promise<string> {
  return fs.readFile(path.join(detailDir, rel), "utf8");
}

async function listVueFiles(): Promise<string[]> {
  const entries = await fs.readdir(detailDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".vue"))
    .map((entry) => entry.name)
    .sort();
}

describe("DetailCtaButton derives from the shared LianButton base", () => {
  it("DetailCtaButton imports LianButton and uses it as the primitive", async () => {
    const src = await read("DetailCtaButton.vue");
    expect(src).toMatch(/from "\.\.\/\.\.\/ui\/LianButton\.vue"/);
    expect(src).toMatch(/<LianButton[\s\S]*?:state="presentation\.buttonState"/);
  });

  it("DetailCtaButton wires aria-busy + aria-pressed + aria-disabled through the presentation contract", async () => {
    // Apple gap §5 toggle-aware ARIA: every state derives the right ARIA
    // bits up-front, no per-call-site toggling.
    const src = await read("DetailCtaButton.vue");
    expect(src).toMatch(/:aria-busy="presentation\.ariaBusy"/);
    expect(src).toMatch(/:pressed="presentation\.ariaPressed \? true : undefined"/);
    expect(src).toMatch(/data-cta-cause="presentation\.ariaCause"/);
  });

  it("DetailCtaButton does not animate via transition: all (RFC §3.2 motion allowlist)", async () => {
    const src = await read("DetailCtaButton.vue");
    expect(src).not.toMatch(/transition:\s*all\b/);
  });
});

describe("LianButton exposes mw#827 toggle-aware ARIA hooks", () => {
  it("LianButton accepts a `pressed` prop and binds it through ariaPressedAttr", async () => {
    const src = await fs.readFile(path.join(repoRoot, "src/ui/LianButton.vue"), "utf8");
    expect(src).toMatch(/pressed\?:\s*boolean;/);
    expect(src).toMatch(/:aria-pressed="ariaPressedAttr"/);
  });

  it("LianButton accepts an `ariaBusy` prop and binds it through ariaBusyAttr", async () => {
    const src = await fs.readFile(path.join(repoRoot, "src/ui/LianButton.vue"), "utf8");
    expect(src).toMatch(/ariaBusy\?:\s*boolean;/);
    expect(src).toMatch(/:aria-busy="ariaBusyAttr"/);
  });

  it("LianButton emits aria-disabled tied to its native disabled bit", async () => {
    const src = await fs.readFile(path.join(repoRoot, "src/ui/LianButton.vue"), "utf8");
    expect(src).toMatch(/:aria-disabled="ariaDisabledAttr"/);
  });
});

describe("detail surface — no transition: all anywhere", () => {
  it("rejects `transition: all` in any detail-page .vue file", async () => {
    const files = await listVueFiles();
    const offenders: Array<{ file: string; line: number }> = [];
    for (const name of files) {
      const src = await read(name);
      const lines = src.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (/transition:\s*all\b/.test(line)) {
          offenders.push({ file: name, line: idx + 1 });
        }
      });
    }
    if (offenders.length > 0) {
      throw new Error(
        [
          "Found `transition: all` in detail-page .vue file(s) — this violates motion contract §3.2.",
          "Enumerate the actual properties you animate (color / background-color / opacity / transform).",
          "",
          ...offenders.map((o) => `  ${o.file}:${o.line}`),
        ].join("\n"),
      );
    }
    expect(offenders).toEqual([]);
  });
});

describe("detail surface — primary CTAs derive from DetailCtaButton or LianButton", () => {
  it("PostDetailMerchantBlock primary errand CTA goes through DetailCtaButton", async () => {
    const src = await read("PostDetailMerchantBlock.vue");
    // The block must not inline a bare <button> for the errand CTA — that
    // is the exact regression the wave 3-A vocabulary exists to prevent.
    expect(src).toMatch(/import DetailCtaButton from "\.\/DetailCtaButton\.vue"/);
    expect(src).toMatch(/<DetailCtaButton[\s\S]*?test-id="post-detail-merchant-errand-cta"/);
  });

  it("every detail-page .vue file with a bare <button> is on the grandfathered allowlist", async () => {
    const files = await listVueFiles();
    const offenders: string[] = [];
    for (const name of files) {
      const src = await read(name);
      // Look for a `<button` opener in the template. The DetailCtaButton.vue
      // file itself is allowed because it IS the shared primitive wrapper.
      if (name === "DetailCtaButton.vue") continue;
      const hasBareButton = /<button\b[^>]*>/.test(src);
      if (!hasBareButton) continue;
      if (Object.prototype.hasOwnProperty.call(GRANDFATHERED_BARE_BUTTONS, name)) continue;
      offenders.push(name);
    }
    if (offenders.length > 0) {
      throw new Error(
        [
          "Found primary <button> elements in detail-page .vue file(s) outside the grandfathered allowlist:",
          ...offenders.map((f) => `  src/features/detail/${f}`),
          "",
          "Either:",
          "  1) migrate the button to <DetailCtaButton> with a 6-state state prop, OR",
          "  2) if the button is genuinely not a primary CTA (chrome / sheet dismiss / IME control),",
          "     add it to GRANDFATHERED_BARE_BUTTONS in this test with a one-line reason.",
        ].join("\n"),
      );
    }
    expect(offenders).toEqual([]);
  });

  it("grandfathered allowlist only references files that exist in src/features/detail", async () => {
    const files = new Set(await listVueFiles());
    const stale: string[] = [];
    for (const name of Object.keys(GRANDFATHERED_BARE_BUTTONS)) {
      if (!files.has(name)) stale.push(name);
    }
    if (stale.length > 0) {
      throw new Error(
        [
          "Grandfathered detail CTA bare-button entries reference files that no longer exist:",
          ...stale.map((f) => `  ${f}`),
          "",
          "Remove the entries — the allowlist is shrinks-only.",
        ].join("\n"),
      );
    }
    expect(stale).toEqual([]);
  });
});
