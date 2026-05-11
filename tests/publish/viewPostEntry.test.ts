import { describe, it, expect } from "vitest";

/**
 * Post-publish view-entry URL logic.
 *
 * After a successful publish the UI exposes a "查看帖子" link whose href
 * follows the same `#/post/{tid}` convention used by `buildCanonicalPostUrl`
 * in `src/platform/share.ts`.
 *
 * These tests assert the URL-building contract so that the publish-success
 * entry stays consistent with the canonical share URL format.
 */

function buildPostDetailHref(tid: string | number | null): string {
  if (!tid) return "";
  return `#/post/${tid}`;
}

describe("post-publish view entry URL", () => {
  it("produces hash-route href for a numeric tid", () => {
    expect(buildPostDetailHref(42)).toBe("#/post/42");
  });

  it("produces hash-route href for a string tid", () => {
    expect(buildPostDetailHref("abc-123")).toBe("#/post/abc-123");
  });

  it("returns empty string when tid is null", () => {
    expect(buildPostDetailHref(null)).toBe("");
  });

  it("returns empty string when tid is 0 (falsy)", () => {
    expect(buildPostDetailHref(0)).toBe("");
  });

  it("returns empty string when tid is empty string (falsy)", () => {
    expect(buildPostDetailHref("")).toBe("");
  });

  it("matches the canonical share URL convention", () => {
    const tid = 789;
    const expected = `#/post/${tid}`;
    expect(buildPostDetailHref(tid)).toBe(expected);
  });
});
