import { describe, expect, it } from "vitest";
import { ref } from "vue";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTitleCandidate } from "../../src/features/publish/usePublishDraft";

/**
 * PRD V0.2 step D — title-candidate state machine.
 *
 * Same shape as step B's body candidate (drives the pure factory directly
 * without booting a component, so we don't have to wire `provide()`). The
 * factory is the same code path PublishView mounts.
 *
 * Step D scope: candidate slot + apply/revert UI only. The actual LLM
 * wiring that fills `titleCandidate` lands in steps E/F — this PR only
 * proves the state machine.
 */

describe("createTitleCandidate state machine (PRD V0.2 step D)", () => {
  it("setTitleCandidate(x) parks the suggestion without touching title", () => {
    const title = ref("");
    const c = createTitleCandidate(title);

    c.setTitleCandidate("polished title");

    expect(c.titleCandidate.value).toBe("polished title");
    expect(title.value).toBe("");
    expect(c.titleCandidateApplied.value).toBe(false);
    expect(c.titleCandidateVisible.value).toBe(true);
  });

  it("applyTitleCandidate moves the candidate into title and flips applied=true", () => {
    const title = ref("user typed this");
    const c = createTitleCandidate(title);

    c.setTitleCandidate("polished title");
    c.applyTitleCandidate();

    expect(title.value).toBe("polished title");
    expect(c.titleCandidate.value).toBe("polished title");
    expect(c.titleBeforeCandidate.value).toBe("user typed this");
    expect(c.titleCandidateApplied.value).toBe(true);
    expect(c.titleCandidateVisible.value).toBe(true);
  });

  it("revertTitleCandidate restores the previous title and flips applied=false", () => {
    const title = ref("user typed this");
    const c = createTitleCandidate(title);

    c.setTitleCandidate("polished title");
    c.applyTitleCandidate();
    c.revertTitleCandidate();

    expect(title.value).toBe("user typed this");
    expect(c.titleCandidate.value).toBe("polished title");
    expect(c.titleCandidateApplied.value).toBe(false);
    // Bar still visible because the candidate is a fresh, distinct
    // suggestion the user can re-apply with one click.
    expect(c.titleCandidateVisible.value).toBe(true);
  });

  it("revertTitleCandidate from empty title returns title to '' (not the candidate)", () => {
    // Mirrors the body candidate acceptance criterion: post-revert the
    // input goes back to whatever the user actually had — '' if empty.
    const title = ref("");
    const c = createTitleCandidate(title);

    c.setTitleCandidate("polished title");
    c.applyTitleCandidate();
    expect(title.value).toBe("polished title");

    c.revertTitleCandidate();
    expect(title.value).toBe("");
    expect(c.titleCandidate.value).toBe("polished title");
    expect(c.titleCandidateApplied.value).toBe(false);
  });

  it("user-typed title to a third value invalidates the candidate slot", () => {
    const title = ref("user typed this");
    const c = createTitleCandidate(title);

    c.setTitleCandidate("polished title");
    c.applyTitleCandidate();
    expect(c.titleCandidateApplied.value).toBe(true);

    // Simulate the user typing in the title input — title becomes a third
    // value that's neither the candidate nor the saved-previous.
    title.value = "actually a different headline";

    expect(c.titleCandidate.value).toBeNull();
    expect(c.titleBeforeCandidate.value).toBeNull();
    expect(c.titleCandidateApplied.value).toBe(false);
    expect(c.titleCandidateVisible.value).toBe(false);
  });

  it("setting candidate equal to current title keeps the bar hidden (no-op suggestion)", () => {
    const title = ref("user typed this");
    const c = createTitleCandidate(title);

    c.setTitleCandidate("user typed this");

    expect(c.titleCandidate.value).toBe("user typed this");
    expect(c.titleCandidateApplied.value).toBe(false);
    expect(c.titleCandidateVisible.value).toBe(false);
  });

  it("setTitleCandidate(null) clears both candidate and the saved-previous", () => {
    const title = ref("user typed this");
    const c = createTitleCandidate(title);

    c.setTitleCandidate("polished title");
    c.applyTitleCandidate();
    c.setTitleCandidate(null);

    expect(c.titleCandidate.value).toBeNull();
    expect(c.titleBeforeCandidate.value).toBeNull();
    expect(c.titleCandidateApplied.value).toBe(false);
    expect(c.titleCandidateVisible.value).toBe(false);
  });
});

describe("PublishTitleCandidateBar DOM structure (PRD V0.2 step D)", () => {
  // Lock the rendered DOM the same way publishBodyCandidate.test.ts does
  // for the body bar — snapshot the <template> source so any future change
  // to the visibility predicate / button labels / aria wiring forces a
  // conscious update of the test contract.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..");

  function readTemplate(rel: string): string {
    const src = fs.readFileSync(path.join(repoRoot, rel), "utf8");
    const match = src.match(/<template>[\s\S]*?<\/template>/);
    if (!match) throw new Error(`No <template> block found in ${rel}`);
    return match[0];
  }

  it("PublishTitleCandidateBar renders a single button gated on titleCandidateVisible", () => {
    const tpl = readTemplate("src/features/publish/PublishTitleCandidateBar.vue");
    expect(tpl).toMatchSnapshot();
  });

  it("PublishTitleCandidateBar pulls its labels from brand constants only", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/features/publish/PublishTitleCandidateBar.vue"),
      "utf8",
    );
    expect(src).toMatch(/PUBLISH_TITLE_CANDIDATE_APPLY/);
    expect(src).toMatch(/PUBLISH_TITLE_CANDIDATE_REVERT/);
    expect(src).toMatch(/PUBLISH_TITLE_CANDIDATE_LABEL/);
    // Anti-pattern guard: the labels must not appear as hardcoded literals
    // in template-expression position. Comments are fine; quoted labels in
    // JS / Vue interpolation are not.
    const tpl = readTemplate("src/features/publish/PublishTitleCandidateBar.vue");
    expect(tpl).not.toMatch(/['"]帮我起标题['"]/);
    expect(tpl).not.toMatch(/['"]撤回标题['"]/);
  });
});

describe("PublishComposer wires the title-candidate bar under the title input (step D)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..");

  it("PublishComposer mounts PublishTitleCandidateBar after the title field", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/features/publish/PublishComposer.vue"),
      "utf8",
    );

    expect(src).toMatch(/import PublishTitleCandidateBar/);
    expect(src).toMatch(/<PublishTitleCandidateBar/);

    // Order: title bar must come after the title <label> headline block
    // and before the body field, so the candidate strip sits next to the
    // input it edits (mirrors body bar placement under the textarea).
    const headlineIdx = src.search(/publish-composer__headline/);
    const titleBarIdx = src.search(/<PublishTitleCandidateBar/);
    const bodyFieldIdx = src.search(/publish-composer__body-field/);

    expect(headlineIdx).toBeGreaterThan(-1);
    expect(titleBarIdx).toBeGreaterThan(-1);
    expect(bodyFieldIdx).toBeGreaterThan(-1);
    expect(headlineIdx).toBeLessThan(titleBarIdx);
    expect(titleBarIdx).toBeLessThan(bodyFieldIdx);
  });
});
