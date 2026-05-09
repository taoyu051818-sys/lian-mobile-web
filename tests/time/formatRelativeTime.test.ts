import { describe, it, expect } from "vitest";
import { formatRelativeTime, formatTimestampLabel } from "../../src/utils/time";

const NOW = Date.UTC(2026, 4, 8, 10, 0, 0);

function isoOffset(offsetMs: number) {
  return new Date(NOW - offsetMs).toISOString();
}

describe("formatRelativeTime", () => {
  it("returns empty string for invalid or missing timestamps", () => {
    expect(formatRelativeTime("", NOW)).toBe("");
    expect(formatRelativeTime(undefined, NOW)).toBe("");
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
  });

  it("keeps sub-minute timestamps at 刚刚", () => {
    expect(formatRelativeTime(isoOffset(0), NOW)).toBe("刚刚");
    expect(formatRelativeTime(isoOffset(59_999), NOW)).toBe("刚刚");
  });

  it("switches to minutes at the 60s boundary", () => {
    expect(formatRelativeTime(isoOffset(60_000), NOW)).toBe("1分钟前");
    expect(formatRelativeTime(isoOffset(119_999), NOW)).toBe("1分钟前");
    expect(formatRelativeTime(isoOffset(120_000), NOW)).toBe("2分钟前");
    expect(formatRelativeTime(isoOffset(3_599_999), NOW)).toBe("59分钟前");
  });

  it("switches to hours at the 1h boundary", () => {
    expect(formatRelativeTime(isoOffset(3_600_000), NOW)).toBe("1小时前");
    expect(formatRelativeTime(isoOffset(7_199_999), NOW)).toBe("1小时前");
    expect(formatRelativeTime(isoOffset(7_200_000), NOW)).toBe("2小时前");
    expect(formatRelativeTime(isoOffset(86_399_999), NOW)).toBe("23小时前");
  });

  it("shows 昨天 for items between 24h and 48h old", () => {
    expect(formatRelativeTime(isoOffset(86_400_000), NOW)).toBe("昨天");
    expect(formatRelativeTime(isoOffset(172_799_999), NOW)).toBe("昨天");
  });

  it("shows day count for items between 48h and 7d old", () => {
    expect(formatRelativeTime(isoOffset(172_800_000), NOW)).toBe("2天前");
    expect(formatRelativeTime(isoOffset(604_799_999), NOW)).toBe("6天前");
  });

  it("shows absolute date for items 7d or older", () => {
    const sevenDaysAgo = new Date(NOW - 604_800_000);
    const expected = `${sevenDaysAgo.getMonth() + 1}月${sevenDaysAgo.getDate()}日`;
    expect(formatRelativeTime(isoOffset(604_800_000), NOW)).toBe(expected);
  });

  it("treats near-future timestamps as 刚刚", () => {
    const future = new Date(NOW + 1_000).toISOString();
    expect(formatRelativeTime(future, NOW)).toBe("刚刚");
  });

  it("shows absolute date for far-future timestamps", () => {
    const farFuture = new Date(Date.UTC(2026, 4, 10, 10, 0, 0)).toISOString();
    expect(formatRelativeTime(farFuture, NOW)).toBe("5月10日");
  });
});

describe("formatTimestampLabel", () => {
  it("prefers structured timestamps over legacy fallback labels", () => {
    expect(formatTimestampLabel(isoOffset(2 * 60_000), "旧标签", NOW)).toBe("2分钟前");
  });

  it("falls back to legacy label when timestamp is missing", () => {
    expect(formatTimestampLabel(undefined, "旧标签", NOW)).toBe("旧标签");
  });

  it("returns empty string when both timestamp and fallback are missing", () => {
    expect(formatTimestampLabel(undefined, "", NOW)).toBe("");
  });
});
