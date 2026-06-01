import { describe, expect, it } from "vitest";
import { ref } from "vue";

import {
  normalizeProfileListItem,
  normalizeProfileListResponse,
  resolveProfileTabRequest,
} from "../../src/api/profile";
import { useProfileAliasPicker } from "../../src/features/profile/useProfileAliasPicker";

describe("profile activity tab routing", () => {
  it("routes each tab to the live /api/me endpoint", () => {
    expect(resolveProfileTabRequest("saved")).toEqual({ path: "/api/me/saved", method: "GET" });
    expect(resolveProfileTabRequest("liked")).toEqual({ path: "/api/me/liked", method: "GET" });
    expect(resolveProfileTabRequest("posts")).toEqual({ path: "/api/me/posts", method: "GET" });
    expect(resolveProfileTabRequest("replies")).toEqual({ path: "/api/me/replies", method: "GET" });
    expect(resolveProfileTabRequest("drafts")).toEqual({ path: "/api/me/drafts", method: "GET" });
    expect(resolveProfileTabRequest("map-contributions")).toEqual({
      path: "/api/me/map-contributions",
      method: "GET",
    });
    expect(resolveProfileTabRequest("history", [11, 22])).toEqual({
      path: "/api/me/history",
      method: "POST",
      body: JSON.stringify({ tids: [11, 22] }),
    });
  });

  it("rejects the orders tab so it cannot silently fall through to map contributions", () => {
    expect(() => resolveProfileTabRequest("orders")).toThrow(
      /\/api\/errands\/orders\/mine|orders tab is fetched via/i,
    );
  });

  it("forwards the posts content filter as ?presentationIntent= for non-all values", () => {
    // PR-C of #611: posts tab can be narrowed to merchant / trade / help by
    // forwarding presentationIntent through to the existing backend filter
    // (`profile-activity-service.js` parseActivityContentFilter).
    expect(resolveProfileTabRequest("posts", [], { contentFilter: "merchant" })).toEqual({
      path: "/api/me/posts?presentationIntent=merchant",
      method: "GET",
    });
    expect(resolveProfileTabRequest("posts", [], { contentFilter: "trade" })).toEqual({
      path: "/api/me/posts?presentationIntent=trade",
      method: "GET",
    });
    expect(resolveProfileTabRequest("posts", [], { contentFilter: "help" })).toEqual({
      path: "/api/me/posts?presentationIntent=help",
      method: "GET",
    });
  });

  it("treats contentFilter='all' as the no-query default", () => {
    expect(resolveProfileTabRequest("posts", [], { contentFilter: "all" })).toEqual({
      path: "/api/me/posts",
      method: "GET",
    });
    // Explicitly omitting the option must behave the same as "all" so that
    // existing callers that never pass a filter keep working.
    expect(resolveProfileTabRequest("posts")).toEqual({
      path: "/api/me/posts",
      method: "GET",
    });
  });

  it("ignores contentFilter on tabs other than posts", () => {
    // The chip strip is gated on activeTab === "posts" in the view, but the
    // resolver should not silently silently slap a presentationIntent on the
    // wrong endpoint if a caller ever passes one through.
    expect(resolveProfileTabRequest("saved", [], { contentFilter: "merchant" })).toEqual({
      path: "/api/me/saved",
      method: "GET",
    });
    expect(resolveProfileTabRequest("liked", [], { contentFilter: "trade" })).toEqual({
      path: "/api/me/liked",
      method: "GET",
    });
  });
});

describe("profile alias picker", () => {
  it("keeps identity tags as a fallback when tags is an empty array", () => {
    const picker = useProfileAliasPicker({
      user: ref({
        tags: [],
        identityTags: ["校园认证", "商家认证"],
      }),
      loadProfile: async () => {},
    });

    expect(picker.userTags.value).toEqual(["校园认证", "商家认证"]);
  });

  it("prefers explicit tags when present", () => {
    const picker = useProfileAliasPicker({
      user: ref({
        tags: ["活跃用户", "已实名"],
        identityTags: ["校园认证"],
      }),
      loadProfile: async () => {},
    });

    expect(picker.userTags.value).toEqual(["活跃用户", "已实名"]);
  });
});

describe("profile activity normalization", () => {
  it("preserves topic-backed activity metadata", () => {
    expect(
      normalizeProfileListItem({
        tid: 88,
        title: "校园公告",
        cover: "https://img.example/cover.jpg",
        timestampISO: "2026-05-20T00:00:00.000Z",
        timeLabel: "2026-05-20",
        locationArea: "东区",
        status: "pending",
        visibility: "campus",
      }),
    ).toEqual({
      tid: 88,
      id: "88",
      title: "校园公告",
      cover: "https://img.example/cover.jpg",
      timestampISO: "2026-05-20T00:00:00.000Z",
      timeLabel: "2026-05-20",
      locationArea: "东区",
      status: "pending",
      visibility: "campus",
    });
  });

  it("keeps draft rows usable even without a tid", () => {
    expect(
      normalizeProfileListItem({
        id: "draft-1",
        title: "草稿箱内容",
        status: "draft",
        locationArea: "图书馆",
      }),
    ).toEqual({
      id: "draft-1",
      title: "草稿箱内容",
      locationArea: "图书馆",
      status: "draft",
    });
  });

  it("drops unknown visibility values instead of inventing a badge", () => {
    expect(
      normalizeProfileListItem({
        tid: 99,
        title: "异常权限帖子",
        visibility: "friends-only",
      }),
    ).toEqual({
      tid: 99,
      id: "99",
      title: "异常权限帖子",
    });
  });

  it("normalizes relation and action context on activity rows", () => {
    expect(
      normalizeProfileListItem({
        tid: 44,
        title: "活动复盘",
        relations: [
          { type: "event_recap", targetTid: 11 },
          null,
          { type: "missing-target" },
          { target: { kind: "post", id: "22" } },
          { type: "solution_event", target: { kind: "post", id: 33 }, role: "source" },
        ],
        availableActions: [
          {
            type: "claim_reward",
            enabled: false,
            reason: "not_ready",
            reasonText: "活动结束后可领取",
          },
          { type: "mark_solved" },
          { enabled: true, reason: "missing_type" },
          "bad-row",
        ],
      }),
    ).toEqual({
      tid: 44,
      id: "44",
      title: "活动复盘",
      relations: [
        { type: "event_recap", target: { kind: "post", id: "11" } },
        { type: "solution_event", target: { kind: "post", id: "33" }, role: "source" },
      ],
      availableActions: [
        {
          type: "claim_reward",
          enabled: false,
          reason: "not_ready",
          reasonText: "活动结束后可领取",
        },
        { type: "mark_solved" },
      ],
    });
  });

  it("omits empty or fully malformed relation and action arrays", () => {
    expect(
      normalizeProfileListItem({
        tid: 45,
        title: "无上下文内容",
        relations: [{ type: "missing-target" }, null],
        availableActions: [{ enabled: true }, null],
      }),
    ).toEqual({
      tid: 45,
      id: "45",
      title: "无上下文内容",
    });
  });

  it("omits absent, empty, or non-array relation and action context", () => {
    for (const context of [
      {},
      { relations: null, availableActions: null },
      { relations: [], availableActions: [] },
      { relations: { type: "help_event_link" }, availableActions: { type: "claim_reward" } },
    ]) {
      expect(
        normalizeProfileListItem({
          tid: 46,
          title: "上下文为空",
          ...context,
        }),
      ).toEqual({
        tid: 46,
        id: "46",
        title: "上下文为空",
      });
    }
  });

  it("normalizes list responses with mixed graph context rows", () => {
    expect(
      normalizeProfileListResponse({
        items: [
          { tid: 7, title: "第一条", relations: [{ type: "help_event_link", targetTid: 70 }] },
          { id: "draft-2", title: "第二条", availableActions: [{ type: "complete_errand" }] },
        ],
      }),
    ).toEqual({
      items: [
        {
          tid: 7,
          id: "7",
          title: "第一条",
          relations: [{ type: "help_event_link", target: { kind: "post", id: "70" } }],
        },
        { id: "draft-2", title: "第二条", availableActions: [{ type: "complete_errand" }] },
      ],
    });
  });
});
