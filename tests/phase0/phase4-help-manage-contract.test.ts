import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { planHelpManage, parseEventTidInput } from "../../src/domain/helpManagePolicy";
import { normalizePostDetail } from "../../src/api/posts";
import { linkHelpToEvent } from "../../src/api/events";
import type { HelpPostExtension } from "../../src/types/post-extensions";

const apiSendMock = vi.fn();
vi.mock("../../src/api/http", () => ({
  apiGet: vi.fn(),
  apiSend: (...args: unknown[]) => apiSendMock(...args),
}));

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

describe("Phase 4 (help-manage): planHelpManage", () => {
  it("non-managers get an empty plan even on open status", () => {
    const plan = planHelpManage({ help: makeHelp(), isManageable: false });
    expect(plan.canManage).toBe(false);
    expect(plan.allowed.size).toBe(0);
  });

  it("missing help yields an empty plan even when manageable is true", () => {
    const plan = planHelpManage({ help: undefined, isManageable: true });
    expect(plan.canManage).toBe(false);
    expect(plan.allowed.size).toBe(0);
  });

  it("open + manageable allows linkEvent + resolve + close, no unlink", () => {
    const plan = planHelpManage({ help: makeHelp(), isManageable: true });
    expect(plan.canManage).toBe(true);
    expect(plan.allowed.has("linkEvent")).toBe(true);
    expect(plan.allowed.has("resolve")).toBe(true);
    expect(plan.allowed.has("close")).toBe(true);
    expect(plan.allowed.has("unlinkEvent")).toBe(false);
  });

  it("linked_event + manageable swaps linkEvent for unlinkEvent", () => {
    const plan = planHelpManage({
      help: makeHelp({ status: "linked_event", linkedEventTid: 42 }),
      isManageable: true,
    });
    expect(plan.canManage).toBe(true);
    expect(plan.allowed.has("unlinkEvent")).toBe(true);
    expect(plan.allowed.has("resolve")).toBe(true);
    expect(plan.allowed.has("close")).toBe(true);
    expect(plan.allowed.has("linkEvent")).toBe(false);
  });

  it("unknown help status yields no allowed manage actions", () => {
    const plan = planHelpManage({
      help: makeHelp({ status: "open" }) as HelpPostExtension,
      isManageable: true,
    });
    expect(plan.canManage).toBe(true);

    const malformed = {
      ...makeHelp({ status: "open" }),
      status: "expired",
    } as unknown as HelpPostExtension;
    const malformedPlan = planHelpManage({ help: malformed, isManageable: true });
    expect(malformedPlan.canManage).toBe(true);
    expect(malformedPlan.allowed.size).toBe(0);
  });

  describe("Phase 4 (help-manage): linkHelpToEvent payload contract", () => {
    it("sends backend-expected { eventId } payload field", async () => {
      apiSendMock.mockReset();
      apiSendMock.mockResolvedValueOnce({
        helpId: "help-1",
        voteCount: 0,
        commentCount: 0,
        status: "linked_event",
        linkedEventTid: 42,
      });

      await linkHelpToEvent("help-1", 42);

      expect(apiSendMock).toHaveBeenCalledTimes(1);
      const [path, options] = apiSendMock.mock.calls[0] as [
        string,
        { body?: string; method?: string },
      ];
      expect(path).toBe("/api/help/help-1/link-event");
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({ eventId: "42" }));
    });
  });

  it("parses positive integer strings", () => {
    expect(parseEventTidInput("42")).toBe(42);
    expect(parseEventTidInput("  7  ")).toBe(7);
  });

  it("rejects empty / whitespace / non-numeric / non-positive", () => {
    expect(parseEventTidInput("")).toBeNull();
    expect(parseEventTidInput("   ")).toBeNull();
    expect(parseEventTidInput("abc")).toBeNull();
    expect(parseEventTidInput("3.14")).toBeNull();
    expect(parseEventTidInput("-5")).toBeNull();
    expect(parseEventTidInput("0")).toBeNull();
  });
});

describe("Phase 4 (help-manage): post detail wires helpManageable", () => {
  it("normalizePostDetail surfaces helpManageable when present", () => {
    const detail = normalizePostDetail(
      {
        tid: 1,
        title: "x",
        help: { helpId: "h-1", status: "open", voteCount: 0, commentCount: 0 },
        helpManageable: true,
      },
      1,
    );
    expect(detail.helpManageable).toBe(true);
  });

  it("leaves helpManageable undefined when absent", () => {
    const detail = normalizePostDetail({ tid: 1, title: "x" }, 1);
    expect(detail.helpManageable).toBeUndefined();
  });

  it("treats truthy non-boolean values per asBoolean coercion", () => {
    const detail = normalizePostDetail(
      {
        tid: 1,
        title: "x",
        help: { helpId: "h-1", status: "open", voteCount: 0, commentCount: 0 },
        helpManageable: "true",
      },
      1,
    );
    expect(detail.helpManageable).toBe(true);
  });
});

describe("Phase 4 (help-manage): composable + view wiring", () => {
  const composable = readRepoFile("../../src/composables/useHelpManage.ts");
  const view = readRepoFile("../../src/features/detail/PostDetailHelpManageBlock.vue");
  const panel = readRepoFile("../../src/features/detail/PostDetailPanel.vue");

  it("useHelpManage delegates rule decisions to planHelpManage", () => {
    expect(composable).toMatch(/planHelpManage/);
    // Composable must not embed status checks — those live in the policy.
    expect(composable).not.toMatch(/help\.status\s*===\s*['"]open/);
    expect(composable).not.toMatch(/help\.status\s*===\s*['"]linked_event/);
  });

  it("useHelpManage falls back to brand string on action failure (soft-fail)", () => {
    expect(composable).toMatch(/HELP_MANAGE_UNAVAILABLE/);
    expect(composable).not.toMatch(/管理操作暂时不可用/);
  });

  it("useHelpManage exposes link / unlink / resolve / close entry points", () => {
    expect(composable).toMatch(/linkEvent/);
    expect(composable).toMatch(/unlinkEvent/);
    expect(composable).toMatch(/markResolved/);
    expect(composable).toMatch(/markClosed/);
  });

  it("PostDetailHelpManageBlock sources every label from brand constants", () => {
    expect(view).toMatch(/HELP_MANAGE_BLOCK_LABEL/);
    expect(view).toMatch(/HELP_MANAGE_LINK_EVENT/);
    expect(view).toMatch(/HELP_MANAGE_RESOLVE/);
    expect(view).toMatch(/HELP_MANAGE_CLOSE/);
    expect(view).toMatch(/HELP_MANAGE_PENDING/);
    expect(view).not.toMatch(/求助管理/);
    expect(view).not.toMatch(/'标记为已解决'/);
  });

  it("PostDetailPanel wires useHelpManage through usePostDetailExtensions with helpManageable from PostDetail", () => {
    const extensions = readRepoFile("../../src/composables/usePostDetailExtensions.ts");
    expect(panel).toMatch(/usePostDetailExtensions/);
    expect(panel).toMatch(/handleHelpManageLinkEvent/);
    expect(panel).toMatch(/handleHelpManageResolve/);
    expect(panel).toMatch(/handleHelpManageClose/);
    expect(extensions).toMatch(/useHelpManage/);
    expect(extensions).toMatch(/helpManageable/);
    expect(extensions).toMatch(/HELP_MANAGE_LINK_SUCCESS/);
    expect(extensions).toMatch(/HELP_MANAGE_RESOLVE_SUCCESS/);
    expect(extensions).toMatch(/HELP_MANAGE_CLOSE_SUCCESS/);
  });
});
