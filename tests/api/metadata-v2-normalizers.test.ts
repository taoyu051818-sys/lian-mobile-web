import { describe, expect, it } from "vitest";
import {
  extractV2Components,
  normalizeEventExtensionV2,
  normalizeHelpExtensionV2,
  normalizeMerchantExtensionV2,
  normalizeTradeExtensionV2,
} from "../../src/platform/api-normalizers";
import { normalizePostDetail } from "../../src/api/posts";

describe("V2 metadata component extraction", () => {
  it("extracts components array from metadata.components", () => {
    const payload = {
      metadata: {
        components: [
          { type: "event", eventId: "evt_123" },
          { type: "merchant", name: "Test Shop" },
        ],
      },
    };
    const components = extractV2Components(payload);
    expect(components).toHaveLength(2);
    expect(components?.[0]).toEqual({ type: "event", eventId: "evt_123" });
    expect(components?.[1]).toEqual({ type: "merchant", name: "Test Shop" });
  });

  it("returns undefined when metadata.components is missing", () => {
    expect(extractV2Components({})).toBeUndefined();
    expect(extractV2Components({ metadata: {} })).toBeUndefined();
    expect(extractV2Components({ metadata: { components: "not-array" } })).toBeUndefined();
  });

  // mw#965 — Wire contract: `metadata.components` MUST be array-shaped on the
  // API boundary. Backend storage may keep an object map keyed by component
  // kind (location/event/merchant/...), but the DTO/serializer is responsible
  // for converting that map into an array before it leaves the server. The
  // frontend deliberately does NOT detect object shape — keeping array-only
  // here locks in the contract and keeps normalization on one side of the
  // boundary instead of two. If a future change tries to "accept both
  // shapes" on the frontend, this test fails and forces the conversation
  // back to fixing the backend serializer.
  it("rejects object-shaped components (backend DTO must serialize to array)", () => {
    const objectShaped = {
      metadata: {
        components: {
          event: { type: "event", eventId: "evt_obj" },
          merchant: { type: "merchant", name: "Obj Shop" },
        },
      },
    };
    expect(extractV2Components(objectShaped)).toBeUndefined();
  });

  it("filters out invalid component entries", () => {
    const payload = {
      metadata: {
        components: [
          { type: "event", eventId: "evt_123" },
          null,
          "invalid",
          { noType: true },
          { type: "merchant", name: "Shop" },
        ],
      },
    };
    const components = extractV2Components(payload);
    expect(components).toHaveLength(2);
  });
});

describe("V2 event extension normalization", () => {
  it("prefers V2 EventComponent when present", () => {
    const v2Components = [
      {
        type: "event" as const,
        eventId: "evt_v2",
        capacity: 50,
        joinedCount: 10,
        rewardSummary: "V2 reward",
        status: "open" as const,
        location: "V2 location",
      },
    ];
    const v1Value = {
      eventId: "evt_v1",
      capacity: 100,
      joinedCount: 5,
      rewardSummary: "V1 reward",
      location: "V1 location",
    };

    const result = normalizeEventExtensionV2(v2Components, v1Value);
    expect(result).toEqual({
      eventId: "evt_v2",
      capacity: 50,
      joinedCount: 10,
      rewardSummary: "V2 reward",
      status: "open",
      location: "V2 location",
    });
  });

  it("falls back to V1 when V2 components array is undefined", () => {
    const v1Value = {
      eventId: "evt_v1",
      capacity: 100,
      joinedCount: 5,
      startsAt: "2026-06-01T10:00:00Z",
    };

    const result = normalizeEventExtensionV2(undefined, v1Value);
    expect(result?.eventId).toBe("evt_v1");
    expect(result?.capacity).toBe(100);
    expect(result?.joinedCount).toBe(5);
  });

  it("falls back to V1 when V2 event component has no eventId", () => {
    const v2Components = [{ type: "event" as const, capacity: 50 }];
    const v1Value = { eventId: "evt_v1", joinedCount: 5 };

    const result = normalizeEventExtensionV2(v2Components, v1Value);
    expect(result?.eventId).toBe("evt_v1");
  });

  it("returns undefined when neither V2 nor V1 has valid data", () => {
    const result = normalizeEventExtensionV2([], {});
    expect(result).toBeUndefined();
  });
});

describe("V2 help extension normalization", () => {
  it("prefers V2 HelpComponent when present", () => {
    const v2Components = [
      {
        type: "help" as const,
        helpId: "help_v2",
        status: "open" as const,
        voteCount: 15,
        commentCount: 3,
        linkedEventTid: 42,
      },
    ];
    const v1Value = {
      helpId: "help_v1",
      status: "resolved",
      voteCount: 5,
      commentCount: 1,
    };

    const result = normalizeHelpExtensionV2(v2Components, v1Value);
    expect(result).toEqual({
      helpId: "help_v2",
      status: "open",
      voteCount: 15,
      commentCount: 3,
      linkedEventTid: 42,
    });
  });

  it("falls back to V1 when V2 components array is undefined", () => {
    const v1Value = {
      helpId: "help_v1",
      status: "open",
      voteCount: 5,
      commentCount: 1,
    };

    const result = normalizeHelpExtensionV2(undefined, v1Value);
    expect(result?.helpId).toBe("help_v1");
    expect(result?.status).toBe("open");
  });

  it("coerces V2 help linkedEventTid to a positive integer", () => {
    const v2Components = [
      {
        type: "help" as const,
        helpId: "help_v2",
        status: "open" as const,
        linkedEventTid: "42" as never,
      },
    ];

    const result = normalizeHelpExtensionV2(v2Components, {});
    expect(result).toEqual({
      helpId: "help_v2",
      status: "open",
      voteCount: 0,
      commentCount: 0,
      linkedEventTid: 42,
    });
  });

  it("drops non-positive V2 help linkedEventTid", () => {
    const v2Components = [
      {
        type: "help" as const,
        helpId: "help_v2",
        status: "open" as const,
        linkedEventTid: 0,
      },
    ];

    const result = normalizeHelpExtensionV2(v2Components, {});
    expect(result).toEqual({
      helpId: "help_v2",
      status: "open",
      voteCount: 0,
      commentCount: 0,
    });
  });
});

describe("V2 merchant extension normalization", () => {
  it("prefers V2 MerchantComponent when present", () => {
    const v2Components = [
      {
        type: "merchant" as const,
        name: "V2 Shop",
        category: "food" as const,
        hours: "9-18",
        contact: "123-456",
        errandSupported: true,
        verifiedAt: "2026-01-01",
      },
    ];
    const v1Value = {
      name: "V1 Shop",
      category: "service",
      hours: "10-20",
      contact: "999-888",
      errandSupported: false,
    };

    const result = normalizeMerchantExtensionV2(v2Components, v1Value);
    expect(result).toEqual({
      name: "V2 Shop",
      category: "food",
      hours: "9-18",
      contact: "123-456",
      errandSupported: true,
      verifiedAt: "2026-01-01",
    });
  });

  it("falls back to V1 when V2 components array is undefined", () => {
    const v1Value = {
      name: "V1 Shop",
      category: "retail",
      hours: "10-20",
      contact: "999-888",
      errandSupported: false,
      verifiedAt: "",
    };

    const result = normalizeMerchantExtensionV2(undefined, v1Value);
    expect(result?.name).toBe("V1 Shop");
    expect(result?.category).toBe("retail");
  });

  it("falls back to V1 when V2 merchant component has no name", () => {
    const v2Components = [{ type: "merchant" as const, category: "food" as const }];
    const v1Value = { name: "V1 Shop", category: "service" };

    const result = normalizeMerchantExtensionV2(v2Components, v1Value);
    expect(result?.name).toBe("V1 Shop");
  });

  it("defaults unknown category to service", () => {
    const v2Components = [
      { type: "merchant" as const, name: "Shop", category: "unknown" as never },
    ];

    const result = normalizeMerchantExtensionV2(v2Components, {});
    expect(result?.category).toBe("service");
  });
});

describe("V2 trade extension normalization", () => {
  it("prefers V2 TradeComponent when present", () => {
    const v2Components = [
      {
        type: "trade" as const,
        price: "¥200",
        state: "reserved" as const,
        category: "electronics",
        verifiedAt: "2026-01-01",
      },
    ];
    const v1Value = {
      price: "¥100",
      state: "available",
      category: "books",
    };

    const result = normalizeTradeExtensionV2(v2Components, v1Value);
    expect(result).toEqual({
      price: "¥200",
      state: "reserved",
      category: "electronics",
      verifiedAt: "2026-01-01",
    });
  });

  it("falls back to V1 when V2 components array is undefined", () => {
    const v1Value = {
      price: "¥100",
      state: "available",
      category: "books",
      verifiedAt: "",
    };

    const result = normalizeTradeExtensionV2(undefined, v1Value);
    expect(result?.price).toBe("¥100");
    expect(result?.state).toBe("available");
  });

  it("falls back to V1 when V2 trade component has no price", () => {
    const v2Components = [{ type: "trade" as const, state: "sold" as const }];
    const v1Value = { price: "¥100", state: "available" };

    const result = normalizeTradeExtensionV2(v2Components, v1Value);
    expect(result?.price).toBe("¥100");
  });

  it("uses state override when provided", () => {
    const v2Components = [{ type: "trade" as const, price: "¥200", state: "available" as const }];

    const result = normalizeTradeExtensionV2(v2Components, {}, "sold");
    expect(result?.state).toBe("sold");
  });

  it("defaults unknown state to available", () => {
    const v2Components = [{ type: "trade" as const, price: "¥200", state: "unknown" as never }];

    const result = normalizeTradeExtensionV2(v2Components, {});
    expect(result?.state).toBe("available");
  });
});

describe("normalizePostDetail V2 integration", () => {
  it("extracts extensions from V2 components when present", () => {
    const payload = {
      tid: 123,
      title: "Test Post",
      cover: "https://example.com/cover.jpg",
      metadata: {
        components: [
          { type: "event", eventId: "evt_v2", capacity: 50, joinedCount: 10 },
          { type: "merchant", name: "V2 Shop", category: "food" },
        ],
      },
      event: { eventId: "evt_v1", capacity: 100, joinedCount: 5 },
      merchant: { name: "V1 Shop", category: "service" },
    };

    const result = normalizePostDetail(payload, 123);
    expect(result.event?.eventId).toBe("evt_v2");
    expect(result.event?.capacity).toBe(50);
    expect(result.merchant?.name).toBe("V2 Shop");
    expect(result.merchant?.category).toBe("food");
  });

  it("falls back to V1 fields when V2 components are absent", () => {
    const payload = {
      tid: 123,
      title: "Test Post",
      cover: "https://example.com/cover.jpg",
      event: { eventId: "evt_v1", capacity: 100, joinedCount: 5, startsAt: "2026-06-01T10:00:00Z" },
      help: { helpId: "help_v1", status: "open", voteCount: 5, commentCount: 1 },
      merchant: {
        name: "V1 Shop",
        category: "retail",
        hours: "",
        contact: "",
        errandSupported: false,
        verifiedAt: "",
      },
      trade: { price: "¥100", state: "available", category: "books", verifiedAt: "" },
    };

    const result = normalizePostDetail(payload, 123);
    expect(result.event?.eventId).toBe("evt_v1");
    expect(result.event?.capacity).toBe(100);
    expect(result.help?.helpId).toBe("help_v1");
    expect(result.merchant?.name).toBe("V1 Shop");
    expect(result.trade?.price).toBe("¥100");
  });

  it("extracts extensions from object-shaped V2 components when present", () => {
    const payload = {
      tid: 123,
      title: "Test Post",
      metadata: {
        components: {
          event: { type: "event", eventId: "evt_v2_object", capacity: 8, joinedCount: 2 },
          trade: { type: "trade", price: "¥22", state: "reserved", category: "books" },
        },
      },
      event: { eventId: "evt_v1", capacity: 100, joinedCount: 5 },
      trade: { price: "¥11", state: "available", category: "misc" },
    };

    const result = normalizePostDetail(payload, 123);
    expect(result.components).toEqual([
      { type: "event", eventId: "evt_v2_object", capacity: 8, joinedCount: 2 },
      { type: "trade", price: "¥22", state: "reserved", category: "books" },
    ]);
    expect(result.event?.eventId).toBe("evt_v1");
    expect(result.trade?.price).toBe("¥11");
  });

  it("handles empty V2 components array by falling back to V1", () => {
    const payload = {
      tid: 123,
      title: "Test Post",
      metadata: { components: [] },
      event: { eventId: "evt_v1", capacity: 100, joinedCount: 5, startsAt: "2026-06-01T10:00:00Z" },
    };

    const result = normalizePostDetail(payload, 123);
    expect(result.event?.eventId).toBe("evt_v1");
  });
});
