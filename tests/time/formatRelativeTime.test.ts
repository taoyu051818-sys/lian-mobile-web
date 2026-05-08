import test from "node:test";
import assert from "node:assert/strict";

import { formatRelativeTime, formatTimestampLabel } from "../../src/utils/time.ts";

const NOW = Date.UTC(2026, 4, 8, 10, 0, 0);

function isoOffset(offsetMs: number) {
  return new Date(NOW - offsetMs).toISOString();
}

test("formatRelativeTime keeps sub-minute timestamps at 刚刚", () => {
  assert.equal(formatRelativeTime(isoOffset(59_000), NOW), "刚刚");
});

test("formatRelativeTime switches to minutes and hours at the expected boundaries", () => {
  assert.equal(formatRelativeTime(isoOffset(60_000), NOW), "1分钟前");
  assert.equal(formatRelativeTime(isoOffset(60 * 60_000), NOW), "1小时前");
});

test("formatRelativeTime treats one-day-old items as 昨天 and older week-old items as absolute dates", () => {
  assert.equal(formatRelativeTime(isoOffset(24 * 60 * 60_000), NOW), "昨天");
  assert.equal(formatRelativeTime(isoOffset(7 * 24 * 60 * 60_000), NOW), "5月1日");
});

test("formatRelativeTime falls back conservatively for invalid and future timestamps", () => {
  assert.equal(formatRelativeTime("not-a-date", NOW), "");
  assert.equal(formatRelativeTime(new Date(NOW + 30_000).toISOString(), NOW), "刚刚");
  assert.equal(formatRelativeTime(new Date(Date.UTC(2026, 4, 10, 10, 0, 0)).toISOString(), NOW), "5月10日");
});

test("formatTimestampLabel prefers structured timestamps before legacy labels", () => {
  assert.equal(formatTimestampLabel(isoOffset(2 * 60_000), "旧标签", NOW), "2分钟前");
  assert.equal(formatTimestampLabel(undefined, "旧标签", NOW), "旧标签");
});
