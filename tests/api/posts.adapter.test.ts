import { describe, expect, it } from "vitest";
import { backendPostDetailGraphFixture } from "../fixtures/backend-contract-graph";
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

  it("normalizes NodeBB-shaped top-level user aliases on post detail", () => {
    const detail = normalizePostDetail(
      {
        tid: 87,
        title: "NodeBB detail",
        user: {
          uid: 66,
          username: "detail-user",
          displayname: " Detail User ",
          picture: " https://cdn.example.com/detail-user.jpg ",
        },
      },
      87,
    );

    expect(detail.actor).toEqual({
      id: "66",
      username: "detail-user",
      displayName: "Detail User",
      avatarUrl: "https://cdn.example.com/detail-user.jpg",
    });
  });

  it("normalizes NodeBB-shaped reply user aliases on post detail", () => {
    const detail = normalizePostDetail(
      {
        tid: 88,
        replies: [
          {
            pid: "901",
            content: "reply body",
            createdAt: "2026-05-20T10:00:00Z",
            user: {
              uid: 77,
              username: "nodebb-user",
              displayname: " NodeBB User ",
              picture: " https://cdn.example.com/nodebb-user.jpg ",
            },
          },
        ],
      },
      88,
    );

    expect(detail.replies).toEqual([
      {
        id: 901,
        content: "reply body",
        actor: {
          id: "77",
          username: "nodebb-user",
          displayName: "NodeBB User",
          avatarUrl: "https://cdn.example.com/nodebb-user.jpg",
        },
        source: undefined,
        timestampISO: "2026-05-20T10:00:00Z",
      },
    ]);
  });

  it("preserves backend-shaped graph primitives on detail payloads", () => {
    const detail = normalizePostDetail(
      {
        tid: 314,
        title: "Graph detail",
        metadata: {
          components: {
            event: { type: "event", eventId: "evt_314", joinedCount: 4 },
          },
        },
        relations: [
          { type: "help_event_link", target: { kind: "post", id: 99 }, role: "result" },
          { type: "event_followup", targetTid: "100" },
          { bad: true },
        ],
        availableActions: [
          { type: "open_submission", enabled: true },
          { type: "request_review", reason: "needs_identity", reasonText: "Verify first" },
          { enabled: false },
        ],
      },
      314,
    );

    expect(detail.components).toEqual([{ type: "event", eventId: "evt_314", joinedCount: 4 }]);
    expect(detail.relations).toEqual([
      {
        type: "help_event_link",
        target: { kind: "post", id: "99" },
        role: "result",
      },
      {
        type: "event_followup",
        target: { kind: "post", id: "100" },
      },
    ]);
    expect(detail.availableActions).toEqual([
      { type: "open_submission", enabled: true },
      { type: "request_review", reason: "needs_identity", reasonText: "Verify first" },
    ]);
  });

  it("preserves backend contract fixture metadata components, relations, and actions", () => {
    const detail = normalizePostDetail(
      backendPostDetailGraphFixture,
      backendPostDetailGraphFixture.tid,
    );

    expect(detail.metadata).toEqual({
      _v: 2,
      components: backendPostDetailGraphFixture.metadata.components,
    });
    expect(detail.components).toEqual(backendPostDetailGraphFixture.metadata.components);
    expect(detail.event).toEqual({
      eventId: "evt_contract_972",
      location: "North Campus Hall",
      capacity: 40,
      joinedCount: 12,
      rewardSummary: "10 points",
      status: "open",
    });
    expect(detail.help).toEqual({
      helpId: "help_contract_972",
      status: "linked_event",
      voteCount: 7,
      commentCount: 2,
      linkedEventTid: 97201,
    });
    expect(detail.merchant).toEqual({
      name: "Contract Cafe",
      category: "food",
      hours: "09:00-18:00",
      contact: "campus-cafe@example.test",
      errandSupported: true,
      verifiedAt: "2026-06-01T08:00:00.000Z",
    });
    expect(detail.trade).toEqual({
      price: "¥25",
      state: "reserved",
      category: "textbooks",
      verifiedAt: "2026-06-01T09:00:00.000Z",
    });
    expect(detail.relations).toEqual([
      { type: "help_event_link", target: { kind: "post", id: "97202" }, role: "source" },
      { type: "event_reward", target: { kind: "user", id: "u_972" }, role: "recipient" },
    ]);
    expect(detail.availableActions).toEqual(
      backendPostDetailGraphFixture.metadata.availableActions,
    );
  });

  it("coerces V2 help linkedEventTid on post detail and drops non-positive values", () => {
    const withLinkedEvent = normalizePostDetail(
      {
        tid: 401,
        metadata: {
          components: [
            {
              type: "help",
              helpId: "help_401",
              status: "linked_event",
              linkedEventTid: "88",
            },
          ],
        },
      },
      401,
    );

    expect(withLinkedEvent.help).toEqual({
      helpId: "help_401",
      status: "linked_event",
      voteCount: 0,
      commentCount: 0,
      linkedEventTid: 88,
    });

    const withoutLinkedEvent = normalizePostDetail(
      {
        tid: 402,
        metadata: {
          components: [
            {
              type: "help",
              helpId: "help_402",
              status: "open",
              linkedEventTid: 0,
            },
          ],
        },
      },
      402,
    );

    expect(withoutLinkedEvent.help).toEqual({
      helpId: "help_402",
      status: "open",
      voteCount: 0,
      commentCount: 0,
    });
  });

  it("falls back to metadata graph primitives on detail payloads when top-level fields are absent", () => {
    const detail = normalizePostDetail(
      {
        tid: 315,
        metadata: {
          relations: [{ type: "event_followup", target: { kind: "post", id: "101" } }],
          availableActions: [
            { type: "request_review", enabled: false, reasonText: "Verify first" },
          ],
        },
      },
      315,
    );

    expect(detail.relations).toEqual([
      {
        type: "event_followup",
        target: { kind: "post", id: "101" },
      },
    ]);
    expect(detail.availableActions).toEqual([
      { type: "request_review", enabled: false, reasonText: "Verify first" },
    ]);
  });

  it("normalizes top-level and metadata club payloads on post detail", () => {
    const topLevelClub = normalizePostDetail(
      {
        tid: 601,
        title: "Club detail",
        contentType: "club",
        club: {
          id: " club-601 ",
          title: " 摄影协会 ",
          category: "unknown-category",
          leader: " 阿青 ",
          createdAt: "2018-05-20T00:00:00Z",
          members: "56",
          summary: " 记录校园光影 ",
          avatarUrl: " https://cdn.example.com/photo-club.jpg ",
        },
        visibility: "campus",
      },
      601,
    );

    expect(topLevelClub).toMatchObject({
      tid: 601,
      type: "club",
      visibility: "campus",
      club: {
        clubId: "club-601",
        name: "摄影协会",
        category: "other",
        president: "阿青",
        foundedAt: "2018-05-20T00:00:00Z",
        memberCount: 56,
        description: "记录校园光影",
        logoUrl: "https://cdn.example.com/photo-club.jpg",
      },
    });

    const metadataClub = normalizePostDetail(
      {
        tid: 602,
        contentType: "club",
        metadata: {
          club: {
            clubId: " club-602 ",
            name: " 机器人社 ",
            category: "tech",
            president: " 小王 ",
            foundedAt: "2020-09-01T00:00:00Z",
            memberCount: "128",
            description: " 校园机器人活动 ",
            logoUrl: " https://cdn.example.com/club.png ",
          },
          audienceVisibility: "private",
        },
      },
      602,
    );

    expect(metadataClub).toMatchObject({
      tid: 602,
      type: "club",
      visibility: "private",
      club: {
        clubId: "club-602",
        name: "机器人社",
        category: "tech",
        president: "小王",
        foundedAt: "2020-09-01T00:00:00Z",
        memberCount: 128,
        description: "校园机器人活动",
        logoUrl: "https://cdn.example.com/club.png",
      },
    });
  });

  it("drops malformed club detail payloads instead of inventing partial club metadata", () => {
    const detail = normalizePostDetail(
      {
        tid: 603,
        contentType: "club",
        metadata: {
          club: {
            president: "缺少主键和名称",
            memberCount: 10,
          },
        },
      },
      603,
    );

    expect(detail.type).toBe("club");
    expect(detail.club).toBeUndefined();
  });

  it("reads event/help/place/club presentation intents from detail payloads", () => {
    const eventDetail = normalizePostDetail(
      {
        tid: 701,
        title: "Event intent item",
        presentationIntent: "activity",
      },
      701,
    );
    const helpDetail = normalizePostDetail(
      {
        tid: 702,
        title: "Help intent item",
        metadata: { presentationIntent: "help" },
      },
      702,
    );
    const placeDetail = normalizePostDetail(
      {
        tid: 703,
        title: "Place intent item",
        presentationIntent: "place",
      },
      703,
    );
    const clubDetail = normalizePostDetail(
      {
        tid: 704,
        title: "Club intent item",
        metadata: { presentationIntent: "club" },
      },
      704,
    );

    expect(eventDetail.type).toBe("event");
    expect(helpDetail.type).toBe("help");
    expect(placeDetail.type).toBe("place");
    expect(clubDetail.type).toBe("club");
  });

  it("maps location/map content types to place detail type", () => {
    const locationDetail = normalizePostDetail(
      {
        tid: 705,
        title: "Location item",
        contentType: "location",
      },
      705,
    );
    const mapDetail = normalizePostDetail(
      {
        tid: 706,
        title: "Map item",
        contentType: "map",
      },
      706,
    );

    expect(locationDetail.type).toBe("place");
    expect(mapDetail.type).toBe("place");
  });

  it("reads project/review/submission intents without widening PostType beyond phase 1", () => {
    const project = normalizePostDetail(
      {
        tid: 501,
        title: "Project item",
        contentType: "project",
        presentationIntent: "project",
      },
      501,
    );
    const review = normalizePostDetail(
      {
        tid: 502,
        title: "Review item",
        metadata: { presentationIntent: "review" },
      },
      502,
    );
    const submission = normalizePostDetail(
      {
        tid: 503,
        title: "Submission item",
        contentType: "submission",
      },
      503,
    );

    expect(project.type).toBe("text");
    expect(review.type).toBe("text");
    expect(submission.type).toBe("text");
  });

  it("normalizes lightweight like/save payloads", () => {
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

  it("preserves project/review/submission graph primitives without widening PostType", () => {
    const detail = normalizePostDetail(
      {
        tid: 330,
        title: "Project review surface",
        contentType: "project",
        metadata: {
          presentationIntent: "review",
          _v: 2,
          components: [{ type: "quality", status: "pending_review", workflow: "review" }],
          relations: [
            { type: "project_review", target: { kind: "post", id: "331" }, role: "source" },
            { type: "review_submission", target: { kind: "post", id: "332" }, role: "target" },
          ],
          availableActions: [
            { type: "request_review", enabled: true },
            { type: "submit_revision", enabled: false, reasonText: "评审中暂不可修改" },
          ],
        },
      },
      330,
    );

    expect(detail.type).toBe("text");
    expect(detail.components).toEqual([
      { type: "quality", status: "pending_review", workflow: "review" },
    ]);
    expect(detail.relations).toEqual([
      { type: "project_review", target: { kind: "post", id: "331" }, role: "source" },
      { type: "review_submission", target: { kind: "post", id: "332" }, role: "target" },
    ]);
    expect(detail.availableActions).toEqual([
      { type: "request_review", enabled: true },
      { type: "submit_revision", enabled: false, reasonText: "评审中暂不可修改" },
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
