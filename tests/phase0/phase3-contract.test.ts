import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseAiPreviewSuggestions } from "../../src/api/aiPublish";
import { planAiSuggestionPatch } from "../../src/domain/publishAiPolicy";
import type { Audience } from "../../src/types/audience";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("Phase 3: AI publish client (PRD V0.1 §3 / §7.4)", () => {
  it("parseAiPreviewSuggestions tolerates legacy keys (suggestedTitle / suggestedBody)", () => {
    const result = parseAiPreviewSuggestions({
      suggestedTitle: "  hello  ",
      suggestedBody: "world",
      suggestedTag: "#tag",
      confidence: 0.6,
    });
    expect(result.title).toBe("hello");
    expect(result.body).toBe("world");
    expect(result.tag).toBe("#tag");
    expect(result.confidence).toBe(0.6);
  });

  it("parseAiPreviewSuggestions parses suggestedAudience into a normalized Audience", () => {
    const result = parseAiPreviewSuggestions({
      suggestedAudience: { visibility: "school", schoolIds: ["s1"] },
    });
    expect(result.audience).not.toBeNull();
    expect(result.audience?.visibility).toBe("school");
    expect(result.audience?.schoolIds).toEqual(["s1"]);
  });

  it("parseAiPreviewSuggestions clamps confidence into [0,1]", () => {
    expect(parseAiPreviewSuggestions({ confidence: 5 }).confidence).toBe(1);
    expect(parseAiPreviewSuggestions({ confidence: -2 }).confidence).toBe(0);
    expect(parseAiPreviewSuggestions({ confidence: "x" }).confidence).toBe(0);
  });

  it("parseAiPreviewSuggestions returns empty bundle on garbage input", () => {
    const result = parseAiPreviewSuggestions(null);
    expect(result.title).toBe("");
    expect(result.body).toBe("");
    expect(result.tag).toBe("");
    expect(result.audience).toBeNull();
    expect(result.riskFlags).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.needsHumanReview).toBe(false);
  });

  it("parseAiPreviewSuggestions preserves preview candidates while keeping stable draft names", () => {
    const result = parseAiPreviewSuggestions({
      ok: true,
      candidates: {
        title: "  候选标题  ",
        bodyCandidate: "  候选正文  ",
        suggestedComponents: [
          { type: "event_time", reason: "补充活动时间" },
          { kind: "merchant_info", label: "补充商家资料" },
        ],
        inferredKind: "event",
        modelLatencyMs: 42,
        modelName: "preview-contract-test",
      },
    });

    expect(result.title).toBe("候选标题");
    expect(result.body).toBe("候选正文");
    expect(result.candidates).toEqual({
      title: "候选标题",
      bodyCandidate: "候选正文",
      suggestedComponents: [
        { kind: "time", payload: {}, label: "补充活动时间" },
        { kind: "merchant", payload: {}, label: "补充商家资料" },
      ],
      inferredKind: "event",
      modelLatencyMs: 42,
      modelName: "preview-contract-test",
    });
    expect(result.suggestedComponents).toEqual(result.candidates.suggestedComponents);
    expect(result.inferredKind).toBe("event");
  });

  it("parseAiPreviewSuggestions filters non-string riskFlags", () => {
    const result = parseAiPreviewSuggestions({
      riskFlags: ["  warn1 ", 123, null, "warn2"],
    });
    expect(result.riskFlags).toEqual(["warn1", "warn2"]);
  });
});

describe("Phase 3: planAiSuggestionPatch (domain/publishAiPolicy)", () => {
  const allowAll = () => true;

  it("fills empty fields and never clobbers user input", () => {
    const patch = planAiSuggestionPatch(
      { title: "user-title", body: "", tag: "", visibility: "public" },
      { title: "ai-title", body: "ai-body", tag: "ai-tag", audience: null },
      allowAll,
    );
    expect(patch.title).toBeUndefined();
    expect(patch.body).toBe("ai-body");
    expect(patch.tag).toBe("ai-tag");
  });

  it("ignores blank suggestion strings", () => {
    const patch = planAiSuggestionPatch(
      { title: "", body: "", tag: "", visibility: "public" },
      { title: "   ", body: "", tag: "  \n  ", audience: null },
      allowAll,
    );
    expect(patch.title).toBeUndefined();
    expect(patch.body).toBeUndefined();
    expect(patch.tag).toBeUndefined();
  });

  it("does not override a non-public visibility the user already picked", () => {
    const audience: Audience = {
      visibility: "school",
      schoolIds: [],
      orgIds: [],
      roleIds: [],
      userIds: [],
      linkOnly: false,
    };
    const patch = planAiSuggestionPatch(
      { title: "", body: "", tag: "", visibility: "campus" },
      { title: "", body: "", tag: "", audience },
      allowAll,
    );
    expect(patch.visibility).toBeUndefined();
  });

  it("only applies suggested audience that is allowed", () => {
    const audience: Audience = {
      visibility: "school",
      schoolIds: [],
      orgIds: [],
      roleIds: [],
      userIds: [],
      linkOnly: false,
    };
    const denyAll = () => false;
    expect(
      planAiSuggestionPatch(
        { title: "", body: "", tag: "", visibility: "public" },
        { title: "", body: "", tag: "", audience },
        denyAll,
      ).visibility,
    ).toBeUndefined();
    expect(
      planAiSuggestionPatch(
        { title: "", body: "", tag: "", visibility: "public" },
        { title: "", body: "", tag: "", audience },
        allowAll,
      ).visibility,
    ).toBe("school");
  });

  it("ignores linkOnly suggestions (not a publish visibility)", () => {
    const audience: Audience = {
      visibility: "linkOnly",
      schoolIds: [],
      orgIds: [],
      roleIds: [],
      userIds: [],
      linkOnly: true,
    };
    const patch = planAiSuggestionPatch(
      { title: "", body: "", tag: "", visibility: "public" },
      { title: "", body: "", tag: "", audience },
      allowAll,
    );
    expect(patch.visibility).toBeUndefined();
  });
});

describe("Phase 3: usePublishAiDraft composable", () => {
  const composable = readRepoFile("../../src/composables/usePublishAiDraft.ts");

  it("triggers preview on the first uploaded image (empty → non-empty)", () => {
    expect(composable).toMatch(/watch\(/);
    expect(composable).toMatch(/uploadedImageUrls\.value\.length/);
    expect(composable).toMatch(/prev \?\? 0/);
  });

  it("uses an inflight ticket to drop stale responses", () => {
    expect(composable).toMatch(/inflight/);
    expect(composable).toMatch(/ticket !== inflight/);
  });

  it("delegates field-application to the caller via onSuggestion (no embedded business rules)", () => {
    expect(composable).toMatch(/onSuggestion/);
    // The composable must not reach into title/body/tag refs to apply rules itself.
    expect(composable).not.toMatch(/title\.value\s*=/);
    expect(composable).not.toMatch(/tagInput/);
  });

  it("imports the AI-unavailable copy from brand instead of hardcoding it", () => {
    expect(composable).toMatch(/PUBLISH_AI_UNAVAILABLE/);
    expect(composable).not.toMatch(/AI 草稿暂时不可用/);
  });

  it("publishes a refresh() escape hatch for explicit re-runs", () => {
    expect(composable).toMatch(/async function refresh/);
    expect(composable).toMatch(/return\s*\{[^}]*refresh\s*[},]/);
  });

  it("accepts an injected fetcher and invalidates work on attempt change or scope disposal", () => {
    expect(composable).toMatch(/fetcher/);
    expect(composable).toMatch(/attemptGeneration/);
    expect(composable).toMatch(/onScopeDispose/);
  });
});

describe("Phase 3: publish flow wires AI policy + post-upload location panel", () => {
  const draft = readRepoFile("../../src/features/publish/usePublishDraft.ts");
  const ai = readRepoFile("../../src/features/publish/usePublishAi.ts");
  const composer = readRepoFile("../../src/features/publish/PublishComposer.vue");
  const view = readRepoFile("../../src/features/publish/PublishView.vue");

  it("publish flow delegates suggestion application to planAiSuggestionPatch", () => {
    // The policy lives in usePublishAi.ts (extracted out of usePublishDraft to
    // keep that file focused on form/upload state). usePublishDraft must still
    // wire it up via the AI sub-composable, and neither file may hand-roll the
    // empty-field check that planAiSuggestionPatch owns.
    expect(ai).toMatch(/planAiSuggestionPatch/);
    expect(ai).toMatch(/onSuggestion/);
    expect(draft).toMatch(/usePublishAi/);
    expect(draft).not.toMatch(/!title\.value\.trim\(\)/);
    expect(ai).not.toMatch(/!title\.value\.trim\(\)/);
  });

  it("usePublishDraft re-exports AI state as flat fields (no nested ai object)", () => {
    expect(draft).toMatch(/aiLoading/);
    expect(draft).toMatch(/aiRiskFlags/);
    expect(draft).toMatch(/aiRefresh/);
  });

  it("shares one attempt-generation ref across both publish AI paths", () => {
    expect(draft).toMatch(/PublishAiAttemptContext/);
    expect(draft).toMatch(/provide\(PublishAiAttemptContextKey/);
    expect(ai).toMatch(/attemptGeneration/);
    expect(composer).toMatch(/useInjectedPublishAiAttemptContext/);
    expect(composer).toMatch(/imageUrls:/);
    expect(composer).toMatch(/locationLabel:/);
    expect(composer).toMatch(/attemptGeneration:/);
  });

  it("resetForm clears every transient AI sink and advances the attempt", () => {
    const resetAttempt = draft.slice(
      draft.indexOf("function resetAiAttempt()"),
      draft.indexOf("function resetForm("),
    );
    const resetForm = draft.slice(
      draft.indexOf("function resetForm("),
      draft.indexOf("onBeforeUnmount", draft.indexOf("function resetForm(")),
    );

    expect(resetAttempt).toMatch(/candidate\.setBodyCandidate\(null\)/);
    expect(resetAttempt).toMatch(/titleCandidate\.setTitleCandidate\(null\)/);
    expect(resetAttempt).toMatch(/suggestedComponents\.value\s*=\s*\[\]/);
    expect(resetAttempt).toMatch(/llmInferredKind\.value\s*=\s*null/);
    expect(resetAttempt).toMatch(/aiAttemptGeneration\.value\s*\+=\s*1/);
    expect(resetForm).toMatch(/resetAiAttempt\(\)/);
  });

  it("usePublishDraft surfaces notifyFirstUploadComplete on its public surface", () => {
    expect(draft).toMatch(/notifyFirstUploadComplete/);
    expect(draft).toMatch(/return\s*\{[\s\S]*notifyFirstUploadComplete/);
  });

  it("PublishView opens the location panel on first successful upload (PRD §7.4.2)", () => {
    expect(view).toMatch(/notifyFirstUploadComplete/);
    expect(view).toMatch(/locationOptions\.toggleLocationPanel/);
  });

  it("PublishView reads flat ai* fields, not the nested ai object", () => {
    expect(view).toMatch(/draft\.aiLoading/);
    expect(view).toMatch(/draft\.aiRiskFlags/);
    expect(view).not.toMatch(/draft\.ai\.loading/);
    expect(view).not.toMatch(/draft\.ai\.riskFlags/);
  });

  it("PublishView sources its AI strings from brand constants, not hardcoded Chinese", () => {
    expect(view).toMatch(/PUBLISH_AI_PENDING/);
    expect(view).toMatch(/PUBLISH_AI_RISK_LABEL/);
    expect(view).not.toMatch(/AI 正在分析图片/);
    expect(view).not.toMatch(/'AI 风险提示'/);
  });
});
