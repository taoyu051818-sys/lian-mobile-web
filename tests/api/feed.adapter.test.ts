import { describe, expect, it } from "vitest";
import { normalizeFeedCardTemplate, normalizeFeedItem } from "../../src/api/feed";

describe("feed adapter normalization", () => {
  it("maps club content type to the dedicated club card template", () => {
    expect(
      normalizeFeedCardTemplate({
        cover: "",
        contentType: "club",
        presentationIntent: null,
        cardTemplate: undefined,
      }),
    ).toEqual({
      cardTemplate: "club",
      cardTemplateSource: "content-type",
      presentationIntent: null,
    });
  });

  it("maps project/review/submission content types to text cards", () => {
    expect(
      normalizeFeedCardTemplate({
        cover: "",
        contentType: "project",
        presentationIntent: null,
        cardTemplate: undefined,
      }),
    ).toEqual({
      cardTemplate: "text",
      cardTemplateSource: "content-type",
      presentationIntent: null,
    });

    expect(
      normalizeFeedCardTemplate({
        cover: "",
        contentType: "review",
        presentationIntent: null,
        cardTemplate: undefined,
      }).cardTemplate,
    ).toBe("text");

    expect(
      normalizeFeedCardTemplate({
        cover: "",
        contentType: "submission",
        presentationIntent: null,
        cardTemplate: undefined,
      }).cardTemplate,
    ).toBe("text");
  });

  it("normalizes nested actor/source records on feed items like post detail does", () => {
    const item = normalizeFeedItem({
      tid: "64",
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
    });

    expect(item).toMatchObject({
      tid: 64,
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
    });
  });

  it("normalizes NodeBB-shaped user aliases on feed items", () => {
    const item = normalizeFeedItem({
      tid: "65",
      user: {
        uid: 88,
        username: "nodebb-feed-user",
        displayname: " Feed User ",
        picture: " https://cdn.example.com/feed-user.jpg ",
      },
    });

    expect(item).toMatchObject({
      tid: 65,
      actor: {
        id: "88",
        username: "nodebb-feed-user",
        displayName: "Feed User",
        avatarUrl: "https://cdn.example.com/feed-user.jpg",
      },
    });
  });

  it("preserves backend-shaped graph primitives on feed items", () => {
    const item = normalizeFeedItem({
      tid: "41",
      title: "Graph item",
      contentType: "project",
      metadata: {
        components: {
          event: { type: "event", eventId: "evt_feed", joinedCount: 3 },
        },
      },
      relationHint: "event_followup",
      relations: [
        {
          type: "help_event_link",
          target: { kind: "post", id: 88 },
          role: "source",
        },
      ],
      availableActions: [
        { type: "open_submission", enabled: true },
        { type: "request_review", reason: "needs_identity", reasonText: "Need verified identity" },
      ],
    });

    expect(item).toMatchObject({
      tid: 41,
      cardTemplate: "text",
      cardTemplateSource: "content-type",
      relationHint: "event_followup",
      components: [{ type: "event", eventId: "evt_feed", joinedCount: 3 }],
      relations: [
        {
          type: "help_event_link",
          targetTid: 88,
        },
      ],
      availableActions: [
        { type: "open_submission", enabled: true },
        {
          type: "request_review",
          reason: "needs_identity",
          reasonText: "Need verified identity",
        },
      ],
    });
  });

  it("falls back to metadata graph primitives on feed items when top-level fields are absent", () => {
    const item = normalizeFeedItem({
      tid: 53,
      metadata: {
        relationHint: "trade_offer_link",
        relations: [{ type: "help_event_link", target: { kind: "post", id: "77" } }],
        availableActions: [{ type: "request_review", enabled: false, reason: "needs_identity" }],
      },
    });

    expect(item).toMatchObject({
      tid: 53,
      relationHint: "trade_offer_link",
      relations: [{ type: "help_event_link", targetTid: 77 }],
      availableActions: [{ type: "request_review", enabled: false, reason: "needs_identity" }],
    });
  });

  it("falls back to metadata presentationIntent when top-level presentationIntent is invalid", () => {
    const item = normalizeFeedItem({
      tid: 54,
      contentType: "project",
      presentationIntent: "unknown-card",
      metadata: { presentationIntent: "help" },
    });

    expect(item).toMatchObject({
      tid: 54,
      cardTemplate: "help",
      cardTemplateSource: "server",
      presentationIntent: "help",
    });
  });

  it("omits public visibility from feed items like post detail does", () => {
    const explicitPublic = normalizeFeedItem({
      id: 11,
      visibility: "public",
    });
    const metadataPublic = normalizeFeedItem({
      id: 12,
      metadata: { audienceVisibility: "public" },
    });

    expect(explicitPublic?.visibility).toBeUndefined();
    expect(metadataPublic?.visibility).toBeUndefined();
  });

  it("normalizes club metadata from metadata.club and keeps non-public visibility", () => {
    const item = normalizeFeedItem({
      id: "88",
      metadata: {
        club: {
          clubId: " club-42 ",
          name: " 机器人社 ",
          category: "tech",
          president: " 小王 ",
          foundedAt: "2020-09-01T00:00:00Z",
          memberCount: "128",
          description: " 校园机器人活动 ",
          logoUrl: " https://cdn.example.com/club.png ",
        },
        visibility: "campus",
      },
    });

    expect(item).toMatchObject({
      tid: 88,
      contentType: "club",
      visibility: "campus",
      club: {
        clubId: "club-42",
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

  it("normalizes top-level club payload aliases and defaults invalid visibility", () => {
    const item = normalizeFeedItem({
      id: 7,
      club: {
        id: "org-7",
        title: " 摄影协会 ",
        category: "unknown-category",
        leader: " 阿青 ",
        createdAt: "2018-05-20T00:00:00Z",
        members: "56",
        summary: " 记录校园光影 ",
        avatarUrl: " https://cdn.example.com/photo-club.jpg ",
      },
      visibility: "mystery",
    });

    expect(item).toMatchObject({
      tid: 7,
      contentType: "club",
      club: {
        clubId: "org-7",
        name: "摄影协会",
        category: "other",
        president: "阿青",
        foundedAt: "2018-05-20T00:00:00Z",
        memberCount: 56,
        description: "记录校园光影",
        logoUrl: "https://cdn.example.com/photo-club.jpg",
      },
    });
    expect(item?.visibility).toBeUndefined();
  });

  it("drops malformed club metadata instead of inventing a partial club block", () => {
    const item = normalizeFeedItem({
      id: 9,
      contentType: "club",
      metadata: {
        club: {
          president: "缺少主键和名称",
          memberCount: 10,
        },
      },
      visibility: "private",
    });

    expect(item).toMatchObject({
      tid: 9,
      contentType: "club",
      visibility: "private",
    });
    expect(item?.club).toBeUndefined();
  });
});
