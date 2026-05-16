import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_PROFILE_STATS,
  normalizeProfileListResponse,
  normalizeProfileSettings,
  normalizeProfileStats,
} from "../../src/api/profile";

describe("profile me-contract normalization", () => {
  it("keeps safe defaults when stats fields are missing", () => {
    expect(normalizeProfileStats({})).toEqual(DEFAULT_PROFILE_STATS);
  });

  it("normalizes stats values from mixed numeric payloads", () => {
    expect(
      normalizeProfileStats({
        posts: "4",
        replies: 3,
        saved: "2",
        liked: 1,
        drafts: "0",
        mapContributions: "5",
      }),
    ).toEqual({
      posts: 4,
      replies: 3,
      saved: 2,
      liked: 1,
      drafts: 0,
      mapContributions: 5,
    });
  });

  it("normalizes settings booleans and visibility safely", () => {
    expect(
      normalizeProfileSettings({
        notificationEnabled: false,
        profileVisibility: "private",
        allowMessageMentions: "1",
      }),
    ).toEqual({
      notificationEnabled: false,
      profileVisibility: "private",
      allowMessageMentions: true,
    });

    expect(normalizeProfileSettings({ profileVisibility: "friends-only" })).toEqual(
      DEFAULT_PROFILE_SETTINGS,
    );
  });

  it("normalizes mixed activity payloads into frontend-safe list items", () => {
    expect(
      normalizeProfileListResponse({
        items: [
          {
            tid: "42",
            title: "Map post",
            timestampISO: "2026-05-16T08:00:00.000Z",
            locationArea: "North Gate",
            status: "published",
          },
          {
            id: "draft-1",
            title: "Draft title",
            status: "draft",
          },
        ],
        pagination: {
          totalCount: "4",
          count: "2",
          limit: "2",
          hasMore: true,
        },
      }),
    ).toEqual({
      items: [
        {
          tid: 42,
          title: "Map post",
          timestampISO: "2026-05-16T08:00:00.000Z",
          locationArea: "North Gate",
          status: "published",
        },
        {
          id: "draft-1",
          title: "Draft title",
          status: "draft",
        },
      ],
      pagination: {
        totalCount: 4,
        count: 2,
        limit: 2,
        hasMore: true,
      },
    });
  });
});
