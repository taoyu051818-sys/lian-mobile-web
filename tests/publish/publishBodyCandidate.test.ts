import { describe, expect, it } from "vitest";
import { ref } from "vue";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBodyCandidate } from "../../src/features/publish/usePublishDraft";

/**
 * PRD V0.2 step B — body-candidate state machine.
 *
 * Tests drive the pure factory `createBodyCandidate` directly so we don't
 * have to mount a component (the wrapping `usePublishDraft` calls
 * `provide()` which requires a setup context). The factory is the same
 * code path the component runs through.
 */

describe("createBodyCandidate state machine (PRD V0.2 step B)", () => {
  it("setBodyCandidate(x) parks the suggestion without touching body", () => {
    const body = ref("");
    const c = createBodyCandidate(body);

    c.setBodyCandidate("polished body");

    expect(c.bodyCandidate.value).toBe("polished body");
    expect(body.value).toBe("");
    expect(c.bodyCandidateApplied.value).toBe(false);
    expect(c.bodyCandidateVisible.value).toBe(true);
  });

  it("applyBodyCandidate moves the candidate into body and flips applied=true", () => {
    const body = ref("user typed this");
    const c = createBodyCandidate(body);

    c.setBodyCandidate("polished body");
    c.applyBodyCandidate();

    expect(body.value).toBe("polished body");
    expect(c.bodyCandidate.value).toBe("polished body");
    expect(c.bodyBeforeCandidate.value).toBe("user typed this");
    expect(c.bodyCandidateApplied.value).toBe(true);
    expect(c.bodyCandidateVisible.value).toBe(true);
  });

  it("revertBodyCandidate restores the previous body and flips applied=false", () => {
    const body = ref("user typed this");
    const c = createBodyCandidate(body);

    c.setBodyCandidate("polished body");
    c.applyBodyCandidate();
    c.revertBodyCandidate();

    expect(body.value).toBe("user typed this");
    expect(c.bodyCandidate.value).toBe("polished body");
    expect(c.bodyCandidateApplied.value).toBe(false);
    // Bar still visible because the candidate is a fresh, distinct
    // suggestion the user can re-apply with one click.
    expect(c.bodyCandidateVisible.value).toBe(true);
  });

  it("revertBodyCandidate from empty body returns body to '' (not the candidate)", () => {
    // Acceptance criterion #4 spec: "After revertBodyCandidate() → body === ''"
    // when the original body was empty.
    const body = ref("");
    const c = createBodyCandidate(body);

    c.setBodyCandidate("polished body");
    c.applyBodyCandidate();
    expect(body.value).toBe("polished body");

    c.revertBodyCandidate();
    expect(body.value).toBe("");
    expect(c.bodyCandidate.value).toBe("polished body");
    expect(c.bodyCandidateApplied.value).toBe(false);
  });

  it("user-typed body to a third value invalidates the candidate slot", () => {
    const body = ref("user typed this");
    const c = createBodyCandidate(body);

    c.setBodyCandidate("polished body");
    c.applyBodyCandidate();
    expect(c.bodyCandidateApplied.value).toBe(true);

    // Simulate the user typing in the textarea — body becomes a third
    // value that's neither the candidate nor the saved-previous.
    body.value = "actually let me write something different";

    expect(c.bodyCandidate.value).toBeNull();
    expect(c.bodyBeforeCandidate.value).toBeNull();
    expect(c.bodyCandidateApplied.value).toBe(false);
    expect(c.bodyCandidateVisible.value).toBe(false);
  });

  it("setting candidate equal to current body keeps the bar hidden (no-op suggestion)", () => {
    const body = ref("user typed this");
    const c = createBodyCandidate(body);

    c.setBodyCandidate("user typed this");

    expect(c.bodyCandidate.value).toBe("user typed this");
    expect(c.bodyCandidateApplied.value).toBe(false);
    expect(c.bodyCandidateVisible.value).toBe(false);
  });

  it("setBodyCandidate(null) clears both candidate and the saved-previous", () => {
    const body = ref("user typed this");
    const c = createBodyCandidate(body);

    c.setBodyCandidate("polished body");
    c.applyBodyCandidate();
    c.setBodyCandidate(null);

    expect(c.bodyCandidate.value).toBeNull();
    expect(c.bodyBeforeCandidate.value).toBeNull();
    expect(c.bodyCandidateApplied.value).toBe(false);
    expect(c.bodyCandidateVisible.value).toBe(false);
  });
});

describe("PublishCandidateBar DOM structure (PRD V0.2 step B)", () => {
  // Lock the rendered DOM the same way publishHintPrimitives.test.ts does for
  // PublishMessage / PublishGateNotice — snapshot the <template> source so
  // any future change to the visibility predicate / button labels / aria
  // wiring forces a conscious update of the test contract.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..");

  function readTemplate(rel: string): string {
    const src = fs.readFileSync(path.join(repoRoot, rel), "utf8");
    const match = src.match(/<template>[\s\S]*?<\/template>/);
    if (!match) throw new Error(`No <template> block found in ${rel}`);
    return match[0];
  }

  it("PublishCandidateBar renders a single button gated on bodyCandidateVisible", () => {
    const tpl = readTemplate("src/features/publish/PublishCandidateBar.vue");
    expect(tpl).toMatchSnapshot();
  });

  it("PublishCandidateBar pulls its labels from brand constants only", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/features/publish/PublishCandidateBar.vue"),
      "utf8",
    );
    expect(src).toMatch(/PUBLISH_BODY_CANDIDATE_APPLY/);
    expect(src).toMatch(/PUBLISH_BODY_CANDIDATE_REVERT/);
    expect(src).toMatch(/PUBLISH_BODY_CANDIDATE_LABEL/);
    // Anti-pattern guard: the labels must not appear as hardcoded literals in
    // template-expression position. Comments are fine; ` "..." ` quoted
    // labels in JS / Vue interpolation are not.
    const tpl = readTemplate("src/features/publish/PublishCandidateBar.vue");
    expect(tpl).not.toMatch(/['"]帮我润色['"]/);
    expect(tpl).not.toMatch(/['"]撤回润色['"]/);
  });
});
