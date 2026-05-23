/**
 * Issue #785 / #794 — focused tests for the post capability registry.
 *
 * Cover the two responsibilities the registry takes on from the previous
 * inline-conditional ladder in PostDetailContent.vue:
 *
 *   1. Selection — which registry-backed capability blocks render for the
 *      currently shipped typed post surfaces (help / event / merchant / trade).
 *   2. Fallback — when a typed post arrives without a usable extension, the
 *      typed-fallback block is selected instead of silently skipping.
 *
 * Structured place content still uses its separate place-sheet path, so the
 * registry surface deliberately excludes it. Adapter-side normalization is
 * covered by tests/api/posts.adapter.
 */

import { describe, expect, it } from "vitest";
import {
  resolvePostCapabilities,
  selectPostCapability,
  shouldRenderCapability,
  shouldRenderCapabilityFallback,
  type PostCapabilityInput,
} from "../../src/features/detail/postCapabilityRegistry";
import type {
  EventPostExtension,
  HelpPostExtension,
  MerchantPostExtension,
  TradePostExtension,
} from "../../src/types/post-extensions";

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

describe("postCapabilityRegistry — selection for the currently shipped capability set", () => {
  it("renders the event block when an event extension is present", () => {
    const post: PostCapabilityInput = { type: "event", event: makeEvent() };
    expect(selectPostCapability("event", post)).toBe("render");
    expect(shouldRenderCapability("event", post)).toBe(true);
  });

  it("renders the help block when a help extension is present", () => {
    const post: PostCapabilityInput = { type: "help", help: makeHelp() };
    expect(selectPostCapability("help", post)).toBe("render");
  });

  it("renders the merchant block when a merchant extension is present", () => {
    const post: PostCapabilityInput = { type: "merchant", merchant: makeMerchant() };
    expect(selectPostCapability("merchant", post)).toBe("render");
  });

  it("renders the trade block when a trade extension is present", () => {
    const post: PostCapabilityInput = { type: "trade", trade: makeTrade() };
    expect(selectPostCapability("trade", post)).toBe("render");
  });

  it("resolves the registry-backed capabilities in stable render order", () => {
    const post: PostCapabilityInput = {
      type: "event",
      event: makeEvent(),
      help: makeHelp(),
      merchant: makeMerchant(),
      trade: makeTrade(),
    };
    expect(resolvePostCapabilities(post)).toEqual([
      { id: "event", selection: "render" },
      { id: "help", selection: "render" },
      { id: "merchant", selection: "render" },
      { id: "trade", selection: "render" },
    ]);
  });
});

describe("postCapabilityRegistry — fallback for partially populated typed posts", () => {
  it("returns fallback when the post type is event but no extension was returned", () => {
    const post: PostCapabilityInput = { type: "event" };
    expect(selectPostCapability("event", post)).toBe("fallback");
    expect(shouldRenderCapabilityFallback("event", post)).toBe(true);
    expect(shouldRenderCapability("event", post)).toBe(false);
  });

  it("returns fallback when an event extension exists but lost its eventId", () => {
    // Mirrors the partially-populated case: adapter returned the wrapper but
    // the id needed to wire actions is missing.
    const post: PostCapabilityInput = {
      type: "event",
      event: { ...makeEvent(), eventId: "" },
    };
    expect(selectPostCapability("event", post)).toBe("fallback");
  });

  it("returns fallback for help / merchant / trade typed posts missing their extension", () => {
    expect(selectPostCapability("help", { type: "help" })).toBe("fallback");
    expect(selectPostCapability("merchant", { type: "merchant" })).toBe("fallback");
    expect(selectPostCapability("trade", { type: "trade" })).toBe("fallback");
  });

  it("returns fallback when a help extension lost its helpId", () => {
    const post: PostCapabilityInput = {
      type: "help",
      help: { ...makeHelp(), helpId: "" },
    };
    expect(selectPostCapability("help", post)).toBe("fallback");
  });

  it("does not emit a fallback for image / text posts (no capability implied)", () => {
    const post: PostCapabilityInput = { type: "image" };
    for (const id of ["event", "help", "merchant", "trade"] as const) {
      expect(selectPostCapability(id, post)).toBe("skip");
    }
  });

  it("does not emit a fallback when the type matches but the extension is rendered", () => {
    const post: PostCapabilityInput = { type: "event", event: makeEvent() };
    expect(selectPostCapability("event", post)).toBe("render");
    expect(shouldRenderCapabilityFallback("event", post)).toBe(false);
  });
});

describe("postCapabilityRegistry — adapter boundary", () => {
  it("ignores unknown capability ids without throwing", () => {
    // The registry does not validate capability strings — it just returns
    // skip. This keeps callers safe when a future capability id is referenced
    // by older code.
    const post: PostCapabilityInput = { type: "event", event: makeEvent() };
    // @ts-expect-error — exercising the unknown-id path on purpose.
    expect(selectPostCapability("totally-unknown", post)).toBe("skip");
  });

  it("does not expose place as a registry capability", () => {
    const ids = resolvePostCapabilities({ type: "place" }).map((entry) => entry.id);
    expect(ids).toEqual(["event", "help", "merchant", "trade"]);
  });
});
