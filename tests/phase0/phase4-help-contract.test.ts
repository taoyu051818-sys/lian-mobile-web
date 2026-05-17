import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { planHelpVote, helpHasLinkedEvent } from "../../src/domain/helpVotePolicy";
import { normalizeHelpExtension } from "../../src/platform/api-normalizers";
import { normalizePostDetail } from "../../src/api/posts";
import type { HelpPostExtension } from "../../src/types/post-extensions";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function makeHelp(overrides: Partial<HelpPostExtension> = {}): HelpPostExtension {
  return {
    helpId: "help-1",
    voteCount: 0,
    commentCount: 0,
    status: "open",
    ...overrides,
  };
}

describe("Phase 4 (help): planHelpVote (domain/helpVotePolicy)", () => {
  it("authenticated viewer who hasn't voted gets enabled vote button", () => {
    const plan = planHelpVote({
      help: makeHelp(),
      isAuthenticated: true,
      hasVoted: false,
    });
    expect(plan.mode).toBe("vote");
    expect(plan.enabled).toBe(true);
    expect(plan.reasonKey).toBe("");
  });

  it("guest viewer is disabled with notSignedIn reason", () => {
    const plan = planHelpVote({
      help: makeHelp(),
      isAuthenticated: false,
      hasVoted: false,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("notSignedIn");
  });

  it("viewer who already voted gets enabled unvote button", () => {
    const plan = planHelpVote({
      help: makeHelp({ voteCount: 1 }),
      isAuthenticated: true,
      hasVoted: true,
    });
    expect(plan.mode).toBe("unvote");
    expect(plan.enabled).toBe(true);
  });

  it("resolved help is disabled even when authenticated and voting", () => {
    const plan = planHelpVote({
      help: makeHelp({ status: "resolved" }),
      isAuthenticated: true,
      hasVoted: true,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("alreadyResolved");
  });

  it("closed help is disabled with alreadyClosed reason", () => {
    const plan = planHelpVote({
      help: makeHelp({ status: "closed" }),
      isAuthenticated: true,
      hasVoted: false,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("alreadyClosed");
  });

  it("linked_event status still allows voting", () => {
    const plan = planHelpVote({
      help: makeHelp({ status: "linked_event", linkedEventTid: 42 }),
      isAuthenticated: true,
      hasVoted: false,
    });
    expect(plan.mode).toBe("vote");
    expect(plan.enabled).toBe(true);
  });
});

describe("Phase 4 (help): helpHasLinkedEvent", () => {
  it("returns true only when status is linked_event AND linkedEventTid is positive", () => {
    expect(helpHasLinkedEvent(makeHelp({ status: "linked_event", linkedEventTid: 42 }))).toBe(true);
    expect(helpHasLinkedEvent(makeHelp({ status: "linked_event" }))).toBe(false);
    expect(helpHasLinkedEvent(makeHelp({ status: "open", linkedEventTid: 42 }))).toBe(false);
    expect(helpHasLinkedEvent(makeHelp({ status: "linked_event", linkedEventTid: 0 }))).toBe(false);
  });
});

describe("Phase 4 (help): normalizeHelpExtension", () => {
  it("returns undefined when helpId is missing", () => {
    expect(normalizeHelpExtension({ status: "open" })).toBeUndefined();
  });

  it("returns undefined when status is unknown", () => {
    expect(normalizeHelpExtension({ helpId: "x", status: "wat" })).toBeUndefined();
  });

  it("normalizes a well-formed payload", () => {
    const ext = normalizeHelpExtension({
      helpId: "h-1",
      status: "linked_event",
      voteCount: 5,
      commentCount: 3,
      linkedEventTid: 42,
    });
    expect(ext?.helpId).toBe("h-1");
    expect(ext?.status).toBe("linked_event");
    expect(ext?.voteCount).toBe(5);
    expect(ext?.commentCount).toBe(3);
    expect(ext?.linkedEventTid).toBe(42);
  });

  it("clamps negative counts to 0 and drops invalid linkedEventTid", () => {
    const ext = normalizeHelpExtension({
      helpId: "h-1",
      status: "open",
      voteCount: -5,
      commentCount: -1,
      linkedEventTid: 0,
    });
    expect(ext?.voteCount).toBe(0);
    expect(ext?.commentCount).toBe(0);
    expect(ext?.linkedEventTid).toBeUndefined();
  });

  it("accepts string-numeric counts and tid", () => {
    const ext = normalizeHelpExtension({
      helpId: "h-1",
      status: "open",
      voteCount: "12",
      linkedEventTid: "7",
    });
    expect(ext?.voteCount).toBe(12);
    expect(ext?.linkedEventTid).toBe(7);
  });
});

describe("Phase 4 (help): post detail wires the help extension", () => {
  it("normalizePostDetail surfaces help + helpVoted when present", () => {
    const detail = normalizePostDetail(
      {
        tid: 99,
        title: "Lost wallet",
        help: { helpId: "h-1", status: "open", voteCount: 4, commentCount: 0 },
        helpVoted: true,
      },
      99,
    );
    expect(detail.help?.helpId).toBe("h-1");
    expect(detail.help?.status).toBe("open");
    expect(detail.helpVoted).toBe(true);
  });

  it("normalizePostDetail leaves help undefined for non-help posts", () => {
    const detail = normalizePostDetail({ tid: 1, title: "Just text" }, 1);
    expect(detail.help).toBeUndefined();
    expect(detail.helpVoted).toBeUndefined();
  });
});

describe("Phase 4 (help): composable + view wiring", () => {
  const composable = readRepoFile("../../src/composables/useHelpVote.ts");
  const view = readRepoFile("../../src/features/detail/PostDetailHelpBlock.vue");
  const panel = readRepoFile("../../src/features/detail/PostDetailPanel.vue");

  it("useHelpVote delegates the rule decision to planHelpVote", () => {
    expect(composable).toMatch(/planHelpVote/);
    // Composable must not embed status checks — those live in the policy.
    expect(composable).not.toMatch(/help\.status\s*===\s*['"]resolved/);
    expect(composable).not.toMatch(/help\.status\s*===\s*['"]closed/);
  });

  it("useHelpVote falls back to brand string on action failure (soft-fail)", () => {
    expect(composable).toMatch(/HELP_ACTION_UNAVAILABLE/);
    expect(composable).not.toMatch(/求助操作暂时不可用/);
  });

  it("PostDetailHelpBlock sources every label from brand constants", () => {
    expect(view).toMatch(/HELP_BLOCK_LABEL/);
    expect(view).toMatch(/HELP_VOTE/);
    expect(view).toMatch(/HELP_UNVOTE/);
    expect(view).toMatch(/HELP_DISABLED_RESOLVED/);
    expect(view).toMatch(/HELP_DISABLED_CLOSED/);
    expect(view).toMatch(/HELP_DISABLED_NOT_SIGNED_IN/);
    expect(view).toMatch(/HELP_LINKED_EVENT_LABEL/);
    expect(view).not.toMatch(/求助信息/);
    expect(view).not.toMatch(/'我也需要'/);
  });

  it("PostDetailPanel wires useHelpVote through to the content slot", () => {
    expect(panel).toMatch(/useHelpVote/);
    expect(panel).toMatch(/HELP_VOTE_SUCCESS/);
    expect(panel).toMatch(/HELP_UNVOTE_SUCCESS/);
    expect(panel).toMatch(/handleHelpAct/);
    expect(panel).toMatch(/handleHelpOpenLinkedEvent/);
  });
});
