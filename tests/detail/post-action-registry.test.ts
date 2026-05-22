/**
 * Issue #793 — focused tests for the post action registry.
 *
 * Cover the responsibility the registry takes on from the previously
 * scattered inline `v-if` gating in PostDetailContent.vue and adjacent
 * detail blocks: which post-detail action surfaces should be available for
 * a given (post type, viewer role, state) tuple.
 *
 * The registry is a pure function over already-normalized PostDetail fields
 * plus the viewer-role flags the panel already derives — these tests stay
 * focused on selection and never touch DOM, components, or HTTP.
 */

import { describe, expect, it } from "vitest";
import {
  availablePostActions,
  isPostActionAvailable,
  selectPostAction,
  type PostActionContext,
} from "../../src/features/detail/postActionRegistry";
import type {
  EventPostExtension,
  HelpPostExtension,
  HelpStatus,
  MerchantPostExtension,
  TradePostExtension,
  TradeState,
} from "../../src/types/post-extensions";

function makeViewer(
  overrides: Partial<PostActionContext["viewer"]> = {},
): PostActionContext["viewer"] {
  return {
    canManageEvent: false,
    canManageHelp: false,
    canManageTrade: false,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<EventPostExtension> = {}): EventPostExtension {
  return {
    eventId: "evt-1",
    joinedCount: 0,
    startsAt: "2026-05-22T10:00:00Z",
    endsAt: "2026-05-22T12:00:00Z",
    ...overrides,
  };
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

function makeMerchant(overrides: Partial<MerchantPostExtension> = {}): MerchantPostExtension {
  return {
    name: "测试小吃",
    category: "food",
    hours: "",
    contact: "",
    errandSupported: false,
    verifiedAt: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

function makeTrade(overrides: Partial<TradePostExtension> = {}): TradePostExtension {
  return {
    price: "¥9.9",
    state: "available",
    category: "textbooks",
    verifiedAt: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

function ctx(overrides: Partial<PostActionContext> = {}): PostActionContext {
  return {
    type: undefined,
    viewer: makeViewer(),
    ...overrides,
  };
}

describe("postActionRegistry — universal actions (report / hide-reported)", () => {
  it("report is always available regardless of post type", () => {
    expect(isPostActionAvailable("report", ctx({ type: "image" }))).toBe(true);
    expect(isPostActionAvailable("report", ctx({ type: "event", event: makeEvent() }))).toBe(true);
    expect(isPostActionAvailable("report", ctx({ type: "help" }))).toBe(true);
  });

  it("hide-reported is gated on the report-flow follow-up flag", () => {
    expect(
      isPostActionAvailable("hide-reported", ctx({ type: "image", reportFollowUpVisible: false })),
    ).toBe(false);
    expect(
      isPostActionAvailable("hide-reported", ctx({ type: "image", reportFollowUpVisible: true })),
    ).toBe(true);
  });
});

describe("postActionRegistry — event actions by (type, role, state)", () => {
  it("event-act is available for any viewer when the event has a usable extension", () => {
    const post = ctx({ type: "event", event: makeEvent() });
    expect(isPostActionAvailable("event-act", post)).toBe(true);
    expect(selectPostAction("event-act", post)).toBe("available");
  });

  it("event-act is unavailable when the event extension lost its eventId", () => {
    const post = ctx({ type: "event", event: { ...makeEvent(), eventId: "" } });
    expect(isPostActionAvailable("event-act", post)).toBe(false);
  });

  it("event-act is unavailable when the event is in a terminal status", () => {
    for (const status of ["completed", "cancelled"] as const) {
      const post = ctx({ type: "event", event: { ...makeEvent(), status } });
      expect(isPostActionAvailable("event-act", post)).toBe(false);
    }
  });

  it("event-complete needs both a manageable viewer and a non-terminal event", () => {
    const event = makeEvent();
    expect(
      isPostActionAvailable(
        "event-complete",
        ctx({ type: "event", event, viewer: makeViewer({ canManageEvent: false }) }),
      ),
    ).toBe(false);
    expect(
      isPostActionAvailable(
        "event-complete",
        ctx({ type: "event", event, viewer: makeViewer({ canManageEvent: true }) }),
      ),
    ).toBe(true);
    expect(
      isPostActionAvailable(
        "event-complete",
        ctx({
          type: "event",
          event: { ...event, status: "completed" },
          viewer: makeViewer({ canManageEvent: true }),
        }),
      ),
    ).toBe(false);
  });
});

describe("postActionRegistry — help actions by (type, role, state)", () => {
  it("help-act is available for active help (open / linked_event) and unavailable for terminal", () => {
    for (const status of ["open", "linked_event"] as HelpStatus[]) {
      expect(
        isPostActionAvailable("help-act", ctx({ type: "help", help: makeHelp({ status }) })),
      ).toBe(true);
    }
    for (const status of ["resolved", "closed"] as HelpStatus[]) {
      expect(
        isPostActionAvailable("help-act", ctx({ type: "help", help: makeHelp({ status }) })),
      ).toBe(false);
    }
  });

  it("help-act is unavailable when the help extension lost its helpId", () => {
    const post = ctx({ type: "help", help: { ...makeHelp(), helpId: "" } });
    expect(isPostActionAvailable("help-act", post)).toBe(false);
  });

  it("help manage transitions are gated on canManageHelp + status", () => {
    const viewerNo = makeViewer();
    const viewerYes = makeViewer({ canManageHelp: true });

    // canManageHelp = false hides every manage action regardless of status.
    for (const id of [
      "help-link-event",
      "help-unlink-event",
      "help-resolve",
      "help-close",
    ] as const) {
      expect(
        isPostActionAvailable(id, ctx({ type: "help", help: makeHelp(), viewer: viewerNo })),
      ).toBe(false);
    }

    // open: link / resolve / close, but not unlink.
    const open = ctx({ type: "help", help: makeHelp({ status: "open" }), viewer: viewerYes });
    expect(isPostActionAvailable("help-link-event", open)).toBe(true);
    expect(isPostActionAvailable("help-unlink-event", open)).toBe(false);
    expect(isPostActionAvailable("help-resolve", open)).toBe(true);
    expect(isPostActionAvailable("help-close", open)).toBe(true);

    // linked_event: unlink / resolve / close, but not link.
    const linked = ctx({
      type: "help",
      help: makeHelp({ status: "linked_event" }),
      viewer: viewerYes,
    });
    expect(isPostActionAvailable("help-link-event", linked)).toBe(false);
    expect(isPostActionAvailable("help-unlink-event", linked)).toBe(true);
    expect(isPostActionAvailable("help-resolve", linked)).toBe(true);
    expect(isPostActionAvailable("help-close", linked)).toBe(true);

    // resolved / closed: nothing.
    for (const status of ["resolved", "closed"] as HelpStatus[]) {
      const terminal = ctx({ type: "help", help: makeHelp({ status }), viewer: viewerYes });
      for (const id of [
        "help-link-event",
        "help-unlink-event",
        "help-resolve",
        "help-close",
      ] as const) {
        expect(isPostActionAvailable(id, terminal)).toBe(false);
      }
    }
  });
});

describe("postActionRegistry — merchant errand entry", () => {
  it("merchant-errand follows the backend-hoisted errandEntryAvailable flag", () => {
    const merchant = makeMerchant({ errandSupported: true });
    expect(
      isPostActionAvailable(
        "merchant-errand",
        ctx({ type: "merchant", merchant, errandEntryAvailable: true }),
      ),
    ).toBe(true);
    expect(
      isPostActionAvailable(
        "merchant-errand",
        ctx({ type: "merchant", merchant, errandEntryAvailable: false }),
      ),
    ).toBe(false);
    // undefined = merchant doesn't support errand at all.
    expect(isPostActionAvailable("merchant-errand", ctx({ type: "merchant", merchant }))).toBe(
      false,
    );
  });
});

describe("postActionRegistry — trade state transitions mirror the backend matrix", () => {
  const allTargets: TradeState[] = ["available", "reserved", "sold", "cancelled", "hidden"];

  it("hides every transition for non-managers regardless of state", () => {
    const trade = makeTrade({ state: "available" });
    const viewer = makeViewer({ canManageTrade: false });
    for (const target of allTargets) {
      expect(
        isPostActionAvailable(`trade-set-${target}`, ctx({ type: "trade", trade, viewer })),
      ).toBe(false);
    }
  });

  it("from available: reserved / sold / cancelled / hidden are reachable", () => {
    const post = ctx({
      type: "trade",
      trade: makeTrade({ state: "available" }),
      viewer: makeViewer({ canManageTrade: true }),
    });
    expect(isPostActionAvailable("trade-set-available", post)).toBe(false);
    expect(isPostActionAvailable("trade-set-reserved", post)).toBe(true);
    expect(isPostActionAvailable("trade-set-sold", post)).toBe(true);
    expect(isPostActionAvailable("trade-set-cancelled", post)).toBe(true);
    expect(isPostActionAvailable("trade-set-hidden", post)).toBe(true);
  });

  it("from reserved: available / sold / cancelled / hidden are reachable", () => {
    const post = ctx({
      type: "trade",
      trade: makeTrade({ state: "reserved" }),
      viewer: makeViewer({ canManageTrade: true }),
    });
    expect(isPostActionAvailable("trade-set-available", post)).toBe(true);
    expect(isPostActionAvailable("trade-set-reserved", post)).toBe(false);
    expect(isPostActionAvailable("trade-set-sold", post)).toBe(true);
    expect(isPostActionAvailable("trade-set-cancelled", post)).toBe(true);
    expect(isPostActionAvailable("trade-set-hidden", post)).toBe(true);
  });

  it("from hidden: only available / cancelled are reachable (no jumping back to sold/reserved)", () => {
    const post = ctx({
      type: "trade",
      trade: makeTrade({ state: "hidden" }),
      viewer: makeViewer({ canManageTrade: true }),
    });
    expect(isPostActionAvailable("trade-set-available", post)).toBe(true);
    expect(isPostActionAvailable("trade-set-cancelled", post)).toBe(true);
    for (const target of ["reserved", "sold", "hidden"] as TradeState[]) {
      expect(isPostActionAvailable(`trade-set-${target}`, post)).toBe(false);
    }
  });

  it("sold and cancelled are terminal — no outbound transitions", () => {
    for (const state of ["sold", "cancelled"] as TradeState[]) {
      const post = ctx({
        type: "trade",
        trade: makeTrade({ state }),
        viewer: makeViewer({ canManageTrade: true }),
      });
      for (const target of allTargets) {
        expect(isPostActionAvailable(`trade-set-${target}`, post)).toBe(false);
      }
    }
  });
});

describe("postActionRegistry — fallback for unsupported (type, role, state) combos", () => {
  it("typed actions stay unavailable when the typed extension is missing entirely", () => {
    // Mirrors the typed-fallback case from postCapabilityRegistry: a post with
    // type=event but no event payload should not surface any event actions.
    const post = ctx({ type: "event", viewer: makeViewer({ canManageEvent: true }) });
    expect(isPostActionAvailable("event-act", post)).toBe(false);
    expect(isPostActionAvailable("event-complete", post)).toBe(false);
  });

  it("event/help/merchant/trade actions stay unavailable on plain image / text posts", () => {
    const post = ctx({ type: "image" });
    for (const id of [
      "event-act",
      "event-complete",
      "help-act",
      "help-resolve",
      "help-close",
      "merchant-errand",
      "trade-set-reserved",
      "trade-set-sold",
    ] as const) {
      expect(isPostActionAvailable(id, post)).toBe(false);
    }
  });

  it("unknown action ids resolve to unavailable without throwing", () => {
    const post = ctx({ type: "image" });
    // @ts-expect-error — exercising the unknown-id path on purpose.
    expect(isPostActionAvailable("totally-unknown", post)).toBe(false);
  });
});

describe("postActionRegistry — availablePostActions surface", () => {
  it("returns just `report` for a plain text post with no role / no state", () => {
    expect(availablePostActions(ctx({ type: "text" }))).toEqual(["report"]);
  });

  it("returns the full event-author surface when canManageEvent is true and the event is open", () => {
    const list = availablePostActions(
      ctx({
        type: "event",
        event: makeEvent(),
        viewer: makeViewer({ canManageEvent: true }),
        reportFollowUpVisible: true,
      }),
    );
    expect(list).toEqual(["report", "hide-reported", "event-act", "event-complete"]);
  });

  it("returns trade transitions in stable order when the author manages an available listing", () => {
    const list = availablePostActions(
      ctx({
        type: "trade",
        trade: makeTrade({ state: "available" }),
        viewer: makeViewer({ canManageTrade: true }),
      }),
    );
    expect(list).toEqual([
      "report",
      "trade-set-reserved",
      "trade-set-sold",
      "trade-set-cancelled",
      "trade-set-hidden",
    ]);
  });
});
