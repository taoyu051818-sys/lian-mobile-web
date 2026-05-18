import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  isKnownJoinPolicy,
  parseCapacityInput,
  validateEventPublishForm,
} from "../../src/domain/eventPublishPolicy";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

const MESSAGES = {
  startAfterEnd: "END_BEFORE_START",
  capacityNotInt: "CAPACITY_NOT_INT",
  capacityNegative: "CAPACITY_NEGATIVE",
  joinPolicyUnknown: "JOIN_UNKNOWN",
};

describe("Phase 4 (publish): isKnownJoinPolicy", () => {
  it("accepts the four PRD-defined values", () => {
    expect(isKnownJoinPolicy("open")).toBe(true);
    expect(isKnownJoinPolicy("approval_required")).toBe(true);
    expect(isKnownJoinPolicy("org_only")).toBe(true);
    expect(isKnownJoinPolicy("school_only")).toBe(true);
  });

  it("rejects unknown / non-string values", () => {
    expect(isKnownJoinPolicy("anything")).toBe(false);
    expect(isKnownJoinPolicy("")).toBe(false);
    expect(isKnownJoinPolicy(null)).toBe(false);
    expect(isKnownJoinPolicy(7)).toBe(false);
  });
});

describe("Phase 4 (publish): parseCapacityInput", () => {
  it("treats blank as undefined (unlimited)", () => {
    expect(parseCapacityInput("")).toEqual({ ok: true, capacity: undefined });
    expect(parseCapacityInput("   ")).toEqual({ ok: true, capacity: undefined });
  });

  it("accepts a non-negative integer", () => {
    expect(parseCapacityInput("0")).toEqual({ ok: true, capacity: 0 });
    expect(parseCapacityInput("12")).toEqual({ ok: true, capacity: 12 });
  });

  it("rejects non-integers and negatives", () => {
    expect(parseCapacityInput("3.5")).toEqual({ ok: false, reason: "notInt" });
    expect(parseCapacityInput("abc")).toEqual({ ok: false, reason: "notInt" });
    expect(parseCapacityInput("-1")).toEqual({ ok: false, reason: "negative" });
  });
});

describe("Phase 4 (publish): validateEventPublishForm", () => {
  const baseDraft = {
    startsAt: "",
    endsAt: "",
    capacity: "",
    joinPolicy: "open" as const,
  };

  it("returns empty string for an acceptable draft", () => {
    expect(validateEventPublishForm(baseDraft, MESSAGES)).toBe("");
  });

  it("rejects unknown joinPolicy first", () => {
    expect(
      validateEventPublishForm(
        { ...baseDraft, joinPolicy: "wat" as never, capacity: "-1" },
        MESSAGES,
      ),
    ).toBe("JOIN_UNKNOWN");
  });

  it("rejects negative capacity", () => {
    expect(validateEventPublishForm({ ...baseDraft, capacity: "-3" }, MESSAGES)).toBe(
      "CAPACITY_NEGATIVE",
    );
  });

  it("rejects non-integer capacity", () => {
    expect(validateEventPublishForm({ ...baseDraft, capacity: "abc" }, MESSAGES)).toBe(
      "CAPACITY_NOT_INT",
    );
  });

  it("rejects when start >= end", () => {
    expect(
      validateEventPublishForm(
        {
          ...baseDraft,
          startsAt: "2026-05-20T10:00",
          endsAt: "2026-05-20T09:00",
        },
        MESSAGES,
      ),
    ).toBe("END_BEFORE_START");
  });

  it("ignores time check when only one endpoint is present", () => {
    expect(validateEventPublishForm({ ...baseDraft, startsAt: "2026-05-20T10:00" }, MESSAGES)).toBe(
      "",
    );
    expect(validateEventPublishForm({ ...baseDraft, endsAt: "2026-05-20T10:00" }, MESSAGES)).toBe(
      "",
    );
  });
});

describe("Phase 4 (publish): wiring greps", () => {
  const submit = readRepoFile("../../src/features/publish/usePublishSubmit.ts");
  const view = readRepoFile("../../src/features/publish/PublishView.vue");
  const controls = readRepoFile("../../src/features/publish/PublishEventControls.vue");

  it("usePublishSubmit branches to createEvent when postType === 'event'", () => {
    expect(submit).toMatch(/createEvent/);
    expect(submit).toMatch(/postType.*===\s*['"]event/);
    expect(submit).toMatch(/validateEventPublishForm/);
  });

  it("usePublishSubmit soft-fails to PUBLISH_EVENT_UNAVAILABLE", () => {
    expect(submit).toMatch(/PUBLISH_EVENT_UNAVAILABLE/);
    expect(submit).not.toMatch(/活动发布暂时不可用/);
  });

  it("PublishEventControls reads every label from brand constants", () => {
    expect(controls).toMatch(/PUBLISH_POST_TYPE_LABEL/);
    expect(controls).toMatch(/PUBLISH_EVENT_PANEL_LABEL/);
    expect(controls).toMatch(/PUBLISH_EVENT_START_AT/);
    expect(controls).toMatch(/PUBLISH_EVENT_END_AT/);
    expect(controls).toMatch(/PUBLISH_EVENT_CAPACITY/);
    expect(controls).toMatch(/PUBLISH_EVENT_JOIN_POLICY/);
    expect(controls).not.toMatch(/活动设置/);
    expect(controls).not.toMatch(/'报名方式'/);
  });

  it("PublishView wires the event draft refs into the submit composable", () => {
    expect(view).toMatch(/useEventPublishDraft/);
    expect(view).toMatch(/eventDraft\.postType/);
    expect(view).toMatch(/eventDraft\.startsAt/);
    expect(view).toMatch(/eventDraft\.endsAt/);
    expect(view).toMatch(/eventDraft\.capacity/);
    expect(view).toMatch(/eventDraft\.joinPolicy/);
  });
});
