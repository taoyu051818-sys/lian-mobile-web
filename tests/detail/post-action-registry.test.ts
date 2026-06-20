/**
 * Issue #793 — focused tests for the post action registry.
 *
 * Cover the responsibility the registry takes on from the previously
 * scattered inline `v-if` gating in PostDetailContent.vue and adjacent
 * detail blocks: which post-detail action surfaces should be available for
 * a given (post type, viewer role, state) tuple.
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

describe("postActionRegistry — universal actions", () => {
  it("always surfaces report", () => {
    expect(isPostActionAvailable("report", ctx({ type: "image" }))).toBe(true);
    expect(isPostActionAvailable("report", ctx({ type: "event", event: makeEvent() }))).toBe(true);
    expect(isPostActionAvailable("report", ctx({ type: "help" }))).toBe(true);
  });

  it("only surfaces hide-reported after the report follow-up opens", () => {
    expect(
      isPostActionAvailable("hide-reported", ctx({ type: "image", reportFollowUpVisible: false })),
    ).toBe(false);
    expect(
      isPostActionAvailable("hide-reported", ctx({ type: "image", reportFollowUpVisible: true })),
    ).toBe(true);
  });
});

describe("postActionRegistry — event actions", () => {
  it("keeps event-act available for non-terminal event details", () => {
    const post = ctx({ type: "event", event: makeEvent() });
    expect(isPostActionAvailable("event-act", post)).toBe(true);
    expect(selectPostAction("event-act", post)).toBe("available");
  });

  it("hides event actions when the event is terminal or missing its extension id", () => {
    expect(
      isPostActionAvailable(
        "event-act",
        ctx({ type: "event", event: { ...makeEvent(), eventId: "" } }),
      ),
    ).toBe(false);
    for (const status of ["completed", "cancelled"] as const) {
      expect(
        isPostActionAvailable("event-act", ctx({ type: "event", event: makeEvent({ status }) })),
      ).toBe(false);
      expect(
        isPostActionAvailable(
          "event-complete",
          ctx({
            type: "event",
            event: makeEvent({ status }),
            viewer: makeViewer({ canManageEvent: true }),
          }),
        ),
      ).toBe(false);
    }
  });

  it("requires a manageable viewer for event-complete", () => {
    const event = makeEvent();
    expect(
      isPostActionAvailable(
        "event-complete",
        ctx({
          type: "event",
          event,
          viewer: makeViewer({ canManageEvent: false }),
        }),
      ),
    ).toBe(false);
    expect(
      isPostActionAvailable(
        "event-complete",
        ctx({
          type: "event",
          event,
          viewer: makeViewer({ canManageEvent: true }),
        }),
      ),
    ).toBe(true);
  });
});

describe("postActionRegistry — help actions", () => {
  it("keeps help-act available for active help states only", () => {
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

  it("surfaces the linked-event entry only while a linked event exists", () => {
    expect(
      isPostActionAvailable(
        "help-open-linked-event",
        ctx({
          type: "help",
          help: makeHelp({ status: "linked_event", linkedEventTid: 42 }),
        }),
      ),
    ).toBe(true);
    expect(
      isPostActionAvailable(
        "help-open-linked-event",
        ctx({ type: "help", help: makeHelp({ status: "open" }) }),
      ),
    ).toBe(false);
  });

  it("gates help manage actions on both canManageHelp and the current help status", () => {
    const viewerNo = makeViewer();
    const viewerYes = makeViewer({ canManageHelp: true });

    for (const id of ["help-link-event", "help-unlink-event", "help-resolve"] as const) {
      expect(
        isPostActionAvailable(id, ctx({ type: "help", help: makeHelp(), viewer: viewerNo })),
      ).toBe(false);
    }

    const open = ctx({
      type: "help",
      help: makeHelp({ status: "open" }),
      viewer: viewerYes,
    });
    expect(isPostActionAvailable("help-link-event", open)).toBe(true);
    expect(isPostActionAvailable("help-unlink-event", open)).toBe(false);
    expect(isPostActionAvailable("help-resolve", open)).toBe(true);

    const linked = ctx({
      type: "help",
      help: makeHelp({ status: "linked_event", linkedEventTid: 42 }),
      viewer: viewerYes,
    });
    expect(isPostActionAvailable("help-link-event", linked)).toBe(false);
    expect(isPostActionAvailable("help-unlink-event", linked)).toBe(true);
    expect(isPostActionAvailable("help-resolve", linked)).toBe(true);

    for (const status of ["resolved", "closed"] as HelpStatus[]) {
      const terminal = ctx({
        type: "help",
        help: makeHelp({ status }),
        viewer: viewerYes,
      });
      for (const id of ["help-link-event", "help-unlink-event", "help-resolve"] as const) {
        expect(isPostActionAvailable(id, terminal)).toBe(false);
      }
    }
  });
});

describe("postActionRegistry — merchant errand entry", () => {
  it("follows the backend-hoisted errandEntryAvailable flag", () => {
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
    expect(isPostActionAvailable("merchant-errand", ctx({ type: "merchant", merchant }))).toBe(
      false,
    );
  });
});

describe("postActionRegistry — trade transitions", () => {
  const allTargets: TradeState[] = ["available", "reserved", "sold", "cancelled", "hidden"];

  it("hides every trade transition for non-managers", () => {
    const trade = makeTrade({ state: "available" });
    const viewer = makeViewer({ canManageTrade: false });
    for (const target of allTargets) {
      expect(
        isPostActionAvailable(`trade-set-${target}`, ctx({ type: "trade", trade, viewer })),
      ).toBe(false);
    }
  });

  it("mirrors the backend transition matrix for available, reserved, hidden, and terminal states", () => {
    const available = ctx({
      type: "trade",
      trade: makeTrade({ state: "available" }),
      viewer: makeViewer({ canManageTrade: true }),
    });
    expect(isPostActionAvailable("trade-set-available", available)).toBe(false);
    expect(isPostActionAvailable("trade-set-reserved", available)).toBe(true);
    expect(isPostActionAvailable("trade-set-sold", available)).toBe(true);
    expect(isPostActionAvailable("trade-set-cancelled", available)).toBe(true);
    expect(isPostActionAvailable("trade-set-hidden", available)).toBe(true);

    const reserved = ctx({
      type: "trade",
      trade: makeTrade({ state: "reserved" }),
      viewer: makeViewer({ canManageTrade: true }),
    });
    expect(isPostActionAvailable("trade-set-available", reserved)).toBe(true);
    expect(isPostActionAvailable("trade-set-reserved", reserved)).toBe(false);
    expect(isPostActionAvailable("trade-set-sold", reserved)).toBe(true);
    expect(isPostActionAvailable("trade-set-cancelled", reserved)).toBe(true);
    expect(isPostActionAvailable("trade-set-hidden", reserved)).toBe(true);

    const hidden = ctx({
      type: "trade",
      trade: makeTrade({ state: "hidden" }),
      viewer: makeViewer({ canManageTrade: true }),
    });
    expect(isPostActionAvailable("trade-set-available", hidden)).toBe(true);
    expect(isPostActionAvailable("trade-set-cancelled", hidden)).toBe(true);
    for (const target of ["reserved", "sold", "hidden"] as TradeState[]) {
      expect(isPostActionAvailable(`trade-set-${target}`, hidden)).toBe(false);
    }

    for (const state of ["sold", "cancelled"] as TradeState[]) {
      const terminal = ctx({
        type: "trade",
        trade: makeTrade({ state }),
        viewer: makeViewer({ canManageTrade: true }),
      });
      for (const target of allTargets) {
        expect(isPostActionAvailable(`trade-set-${target}`, terminal)).toBe(false);
      }
    }
  });
});

describe("postActionRegistry — fallback behavior", () => {
  it("keeps typed actions unavailable when the matching typed payload is missing", () => {
    const post = ctx({
      type: "event",
      viewer: makeViewer({ canManageEvent: true }),
    });
    expect(isPostActionAvailable("event-act", post)).toBe(false);
    expect(isPostActionAvailable("event-complete", post)).toBe(false);
  });

  it("keeps typed actions unavailable on plain posts", () => {
    const post = ctx({ type: "image" });
    for (const id of [
      "event-act",
      "event-complete",
      "help-act",
      "help-resolve",
      "merchant-errand",
      "trade-set-reserved",
      "trade-set-sold",
    ] as const) {
      expect(isPostActionAvailable(id, post)).toBe(false);
    }
  });

  it("returns unavailable for unknown action ids without throwing", () => {
    const post = ctx({ type: "image" });
    // @ts-expect-error exercising the unknown-id path intentionally.
    expect(isPostActionAvailable("totally-unknown", post)).toBe(false);
  });
});

describe("postActionRegistry — availablePostActions", () => {
  it("returns just report for a plain post", () => {
    expect(availablePostActions(ctx({ type: "text" }))).toEqual(["report"]);
  });

  it("returns the event-author action surface in stable order", () => {
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

  it("returns the active help manager surface in stable order", () => {
    const list = availablePostActions(
      ctx({
        type: "help",
        help: makeHelp({ status: "linked_event", linkedEventTid: 42 }),
        viewer: makeViewer({ canManageHelp: true }),
      }),
    );
    expect(list).toEqual([
      "report",
      "help-act",
      "help-open-linked-event",
      "help-unlink-event",
      "help-resolve",
    ]);
  });

  it("returns trade transitions in stable order for an available listing", () => {
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
