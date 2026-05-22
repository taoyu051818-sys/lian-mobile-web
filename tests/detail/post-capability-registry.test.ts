/**
 * Issue #785 — focused tests for the post capability registry.
 *
 * Cover the two responsibilities the registry takes on from the previous
 * inline-conditional ladder in PostDetailContent.vue:
 *
 *   1. Selection — which capability blocks render for the currently shipped
 *      post types (help / event / merchant / trade / place).
 *   2. Fallback — when a typed post arrives without a usable extension, the
 *      typed-fallback block is selected instead of silently skipping.
 *
 * The registry is a pure function over already-normalized PostDetail fields,
 * so these tests stay focused on selection and never touch DOM, components,
 * or HTTP. Adapter-side normalization is covered by tests/api/posts.adapter.
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
import type { PlaceRef } from "../../src/types/place";

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

function makePlace(overrides: Partial<PlaceRef> = {}): PlaceRef {
  return {
    id: "place-1",
    name: "图书馆",
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

  it("renders the place capability when a structured place ref is present", () => {
    const post: PostCapabilityInput = { type: "place", place: makePlace() };
    expect(selectPostCapability("place", post)).toBe("render");
  });

  it("resolves multiple capabilities on a single post (event + place)", () => {
    const post: PostCapabilityInput = {
      type: "event",
      event: makeEvent(),
      place: makePlace(),
    };
    const resolutions = resolvePostCapabilities(post);
    const map = Object.fromEntries(resolutions.map((r) => [r.id, r.selection]));
    expect(map.event).toBe("render");
    expect(map.place).toBe("render");
    expect(map.help).toBe("skip");
    expect(map.merchant).toBe("skip");
    expect(map.trade).toBe("skip");
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

  it("does not emit a fallback for capabilities that have no typed-fallback block", () => {
    // Place has no typed-fallback in the shipped UI. Missing place ref must
    // resolve to skip (not fallback) so the place sheet entry simply doesn't
    // render.
    const post: PostCapabilityInput = { type: "place" };
    expect(selectPostCapability("place", post)).toBe("skip");
    expect(shouldRenderCapabilityFallback("place", post)).toBe(false);
  });

  it("does not emit a fallback for image / text posts (no capability implied)", () => {
    const post: PostCapabilityInput = { type: "image" };
    for (const id of ["event", "help", "merchant", "trade", "place"] as const) {
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

  it("treats a place ref without an id as skip (adapter contract)", () => {
    // PlaceRef.id is the canonical handle; an empty id is the signal the
    // adapter used to mean "no structured place" (mirrors normalizePlaceRef
    // behavior in src/platform/api-normalizers).
    const post: PostCapabilityInput = {
      type: "place",
      place: { ...makePlace(), id: "" },
    };
    expect(selectPostCapability("place", post)).toBe("skip");
  });
});
