import { describe, expect, it } from "vitest";

import {
  normalizeProfileListItem,
  normalizeProfileListResponse,
  resolveProfileTabRequest,
} from "../../src/api/profile";

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

  it("normalizes list responses through the item helper", () => {
    expect(
      normalizeProfileListResponse({
        items: [
          { tid: 7, title: "第一条" },
          { id: "draft-2", title: "第二条", status: "draft" },
        ],
      }),
    ).toEqual({
      items: [
        { tid: 7, id: "7", title: "第一条" },
        { id: "draft-2", title: "第二条", status: "draft" },
      ],
    });
  });
});
