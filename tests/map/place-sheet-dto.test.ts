import { describe, expect, it } from "vitest";

import { normalizePlaceSheet } from "../../src/api/places.ts";

const rawPlaceSheet = {
  id: 123,
  name: "  南区食堂  ",
  type: " dining ",
  lat: "18.393",
  lng: "110.012",
  status: "official",
  updatedAt: " 2026-05-01T12:00:00Z ",
  source: { provider: " map ", label: " backend ", visible: "true" },
  summary: {
    text: "  后端汇总的地点简介  ",
    sourceCount: "4",
    aiGenerated: "yes",
    confidenceLabel: " high ",
  },
  stats: {
    postCount: "7",
    correctionCount: 0,
    savedCount: "3",
  },
  recentPosts: [
    {
      tid: "42",
      title: "  今日菜单  ",
      excerpt: "  有新窗口开放  ",
      imageUrl: " /covers/canteen.jpg ",
      actor: { displayName: "  小莲  ", avatarUrl: " /avatar.png " },
      timestampISO: " 2026-05-01T11:00:00Z ",
      primaryTag: " 食堂 ",
    },
    null,
    { tid: "bad", title: "没有 tid 的内容" },
  ],
};

describe("normalizePlaceSheet", () => {
  it("normalizes the backend place sheet DTO for map rendering", () => {
    expect(normalizePlaceSheet(rawPlaceSheet)).toEqual({
      id: "123",
      name: "南区食堂",
      type: "dining",
      lat: 18.393,
      lng: 110.012,
      status: "official",
      updatedAt: "2026-05-01T12:00:00Z",
      source: { provider: "map", label: "backend", visible: true },
      summary: {
        text: "后端汇总的地点简介",
        sourceCount: 4,
        aiGenerated: true,
        confidenceLabel: "high",
      },
      stats: {
        postCount: 7,
        correctionCount: 0,
        savedCount: 3,
      },
      recentPosts: [
        {
          tid: 42,
          title: "今日菜单",
          excerpt: "有新窗口开放",
          imageUrl: "/covers/canteen.jpg",
          actor: { displayName: "小莲", avatarUrl: "/avatar.png" },
          timestampISO: "2026-05-01T11:00:00Z",
          primaryTag: "食堂",
        },
      ],
    });
  });

  it("normalizes backend snake_case DTO fields for map rendering", () => {
    expect(
      normalizePlaceSheet({
        id: "p-5",
        name: "后端地点",
        status: "official",
        updated_at: " 2026-05-02T12:00:00Z ",
        summary: {
          text: "  关系汇总  ",
          source_count: "2",
          ai_generated: "false",
          confidence_label: " medium ",
        },
        stats: {
          post_count: "0",
          correction_count: "1",
          saved_count: "4",
        },
        recent_posts: [
          {
            tid: "77",
            title: "  相关帖子  ",
            image_url: " /covers/place.jpg ",
            timestamp_iso: " 2026-05-02T10:00:00Z ",
            primary_tag: " 地点 ",
          },
        ],
      }),
    ).toEqual({
      id: "p-5",
      name: "后端地点",
      status: "official",
      updatedAt: "2026-05-02T12:00:00Z",
      summary: {
        text: "关系汇总",
        sourceCount: 2,
        aiGenerated: false,
        confidenceLabel: "medium",
      },
      stats: {
        postCount: 0,
        correctionCount: 1,
        savedCount: 4,
      },
      recentPosts: [
        {
          tid: 77,
          title: "相关帖子",
          imageUrl: "/covers/place.jpg",
          timestampISO: "2026-05-02T10:00:00Z",
          primaryTag: "地点",
        },
      ],
    });
  });

  it("keeps fallback/empty behavior stable for sparse or invalid DTOs", () => {
    expect(normalizePlaceSheet({ id: "", name: "" })).toEqual({
      id: "",
      name: "",
      status: "pending",
    });
    expect(normalizePlaceSheet({ id: "p-1", name: "图书馆", status: "unknown" })).toEqual({
      id: "p-1",
      name: "图书馆",
      status: "pending",
    });
    expect(
      normalizePlaceSheet({
        id: "p-2",
        name: "操场",
        summary: { text: "" },
        stats: { postCount: null, savedCount: "0" },
        recentPosts: [],
      }),
    ).toEqual({
      id: "p-2",
      name: "操场",
      status: "pending",
      stats: { savedCount: 0 },
    });
  });
});
