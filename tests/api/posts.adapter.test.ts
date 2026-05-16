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
