import { describe, expect, it } from "vitest";
import {
  normalizePostDetail,
  normalizePostLikeResponse,
  normalizePostSaveResponse,
} from "../../src/api/posts";

describe("posts adapter normalization", () => {
  it("normalizes post detail ids, booleans, arrays, and nested records", () => {
    const detail = normalizePostDetail(
      {
        tid: "42",
        title: 99,
        cover: " https://cdn.example.com/cover.jpg ",
        primaryTag: " 校园 ",
        actor: {
          id: 123,
          displayName: " Alice ",
          avatarUrl: " https://cdn.example.com/avatar.jpg ",
          identityTag: " 学生 ",
        },
        source: {
          provider: 8,
          label: " NodeBB ",
          visible: 0,
        },
        place: {
          id: 7,
          name: " 图书馆 ",
          type: 10,
          status: "official",
        },
        timeLabel: 5,
        timestampISO: 1710000000,
        likeCount: "6",
        liked: "true",
        locationArea: " 北区 ",
        contentHtml: " <p>hello</p> ",
        imageUrls: [" https://cdn.example.com/1.jpg ", null, 9, ""],
        sourceUrl: 123,
        replies: [
          {
            id: "9",
            content: 456,
            actor: { id: "reader-1", displayName: " Bob " },
            source: { label: " 回帖 ", visible: "1" },
            timestampISO: 1710000001,
          },
          null,
        ],
        bookmarked: "1",
      },
      42,
    );

    expect(detail).toEqual({
      tid: 42,
      type: "image",
      title: "99",
      cover: "https://cdn.example.com/cover.jpg",
      primaryTag: "校园",
      actor: {
        id: "123",
        displayName: "Alice",
        avatarUrl: "https://cdn.example.com/avatar.jpg",
        identityTag: "学生",
      },
      source: {
        provider: "8",
        label: "NodeBB",
        visible: false,
      },
      place: {
        id: "7",
        name: "图书馆",
        type: "10",
        status: "official",
      },
      timeLabel: "5",
      timestampISO: "1710000000",
      likeCount: 6,
      liked: true,
      locationArea: "北区",
      contentHtml: "<p>hello</p>",
      imageUrls: ["https://cdn.example.com/1.jpg", "9"],
      sourceUrl: "123",
      replies: [
        {
          id: 9,
          content: "456",
          actor: {
            id: "reader-1",
            displayName: "Bob",
          },
          source: {
            label: "回帖",
            visible: true,
          },
          timestampISO: "1710000001",
        },
      ],
      bookmarked: true,
    });
  });

  it("falls back safely when post detail fields are malformed or missing", () => {
    const detail = normalizePostDetail(
      {
        liked: "maybe",
        likeCount: "bad",
        imageUrls: "not-an-array",
        replies: [{ content: "first" }, { id: "bad", content: "second" }],
        saved: 0,
      },
      77,
    );

    expect(detail.tid).toBe(77);
    expect(detail.title).toBe("");
    expect(detail.liked).toBe(false);
    expect(detail.likeCount).toBe(0);
    expect(detail.imageUrls).toEqual([]);
    expect(detail.bookmarked).toBe(false);
    expect(detail.replies).toEqual([
      {
        id: 77001,
        content: "first",
        actor: undefined,
        source: undefined,
        timestampISO: "",
      },
      {
        id: 77002,
        content: "second",
        actor: undefined,
        source: undefined,
        timestampISO: "",
      },
    ]);
  });

  it("normalizes lightweight like and save responses", () => {
    expect(normalizePostLikeResponse({ liked: "1", likeCount: "3" })).toEqual({
      liked: true,
      likeCount: 3,
    });

    expect(normalizePostSaveResponse({ saved: 0 })).toEqual({
      saved: false,
    });
  });
});

describe("posts adapter — V2 graph primitive preservation (mw#967)", () => {
  it("preserves top-level components[] when the backend echoes them", () => {
    const detail = normalizePostDetail(
      {
        tid: 100,
        title: "Components surface",
        components: [
          { type: "event", eventId: "evt_top", capacity: 30, joinedCount: 5 },
          { type: "merchant", name: "Top-level Shop" },
          // Malformed entries should be filtered out, not crash the normalizer.
          null,
          "not-a-component",
          { noType: true },
        ],
      },
      100,
    );

    expect(detail.components).toEqual([
      { type: "event", eventId: "evt_top", capacity: 30, joinedCount: 5 },
      { type: "merchant", name: "Top-level Shop" },
    ]);
  });

  it("falls back to metadata.components when no top-level components[] is present", () => {
    const detail = normalizePostDetail(
      {
        tid: 101,
        title: "Nested components",
        metadata: {
          _v: 2,
          components: [{ type: "help", helpId: "help_v2", status: "open", voteCount: 7 }],
        },
      },
      101,
    );

    expect(detail.components).toEqual([
      { type: "help", helpId: "help_v2", status: "open", voteCount: 7 },
    ]);
    expect(detail.metadata).toEqual({
      _v: 2,
      components: [{ type: "help", helpId: "help_v2", status: "open", voteCount: 7 }],
    });
  });

  it("normalizes relations[] to the canonical { type, target, role? } shape", () => {
    const detail = normalizePostDetail(
      {
        tid: 200,
        title: "Help post with link",
        relations: [
          {
            type: "help_event_link",
            target: { kind: "post", id: "156" },
            role: "source",
          },
          // numeric id — coerced to string
          {
            type: "trade_offer_link",
            target: { kind: "post", id: 442 },
          },
          // legacy { type, targetTid } — folded into canonical shape
          { type: "event_followup", targetTid: 999 },
          // dropped: missing target
          { type: "broken_relation" },
          // dropped: missing type
          { target: { kind: "post", id: "1" } },
          null,
        ],
      },
      200,
    );

    expect(detail.relations).toEqual([
      { type: "help_event_link", target: { kind: "post", id: "156" }, role: "source" },
      { type: "trade_offer_link", target: { kind: "post", id: "442" } },
      { type: "event_followup", target: { kind: "post", id: "999" } },
    ]);
  });

  it("omits relations entirely when the backend ships nothing usable", () => {
    const detail = normalizePostDetail(
      {
        tid: 201,
        relations: ["bad", null, { type: "no_target" }],
      },
      201,
    );

    expect(detail.relations).toBeUndefined();
  });

  it("preserves availableActions[] with type / enabled / reason fields", () => {
    const detail = normalizePostDetail(
      {
        tid: 300,
        title: "Action gating",
        availableActions: [
          { type: "join_event", enabled: true },
          {
            type: "vote_help",
            enabled: false,
            reason: "already_voted",
            reasonText: "已经投过票",
          },
          // type missing → dropped
          { enabled: true },
          // tolerated: enabled absent (treated as enabled-by-default)
          { type: "report_post" },
        ],
      },
      300,
    );

    expect(detail.availableActions).toEqual([
      { type: "join_event", enabled: true },
      {
        type: "vote_help",
        enabled: false,
        reason: "already_voted",
        reasonText: "已经投过票",
      },
      { type: "report_post" },
    ]);
  });

  it("regression: V1 fixture still produces the same fallback for event/help/merchant/trade", () => {
    // Build a V1-only payload (no metadata.components, no top-level components,
    // no relations, no availableActions) and assert the legacy extension
    // fallback path still works exactly as it did before mw#967.
    const detail = normalizePostDetail(
      {
        tid: 500,
        title: "Legacy V1",
        cover: "https://example.com/c.jpg",
        event: {
          eventId: "evt_v1",
          capacity: 20,
          joinedCount: 3,
          startsAt: "2026-06-01T10:00:00Z",
        },
        help: { helpId: "help_v1", status: "open", voteCount: 4, commentCount: 1 },
        merchant: {
          name: "V1 Shop",
          category: "retail",
          hours: "9-18",
          contact: "123",
          errandSupported: false,
          verifiedAt: "",
        },
        trade: { price: "¥50", state: "available", category: "books", verifiedAt: "" },
      },
      500,
    );

    // Legacy extensions: untouched
    expect(detail.event?.eventId).toBe("evt_v1");
    expect(detail.help?.helpId).toBe("help_v1");
    expect(detail.merchant?.name).toBe("V1 Shop");
    expect(detail.trade?.price).toBe("¥50");
    // Graph primitives: silently absent (additive, no false positives)
    expect(detail.components).toBeUndefined();
    expect(detail.relations).toBeUndefined();
    expect(detail.availableActions).toBeUndefined();
    expect(detail.metadata).toBeUndefined();
  });
});
