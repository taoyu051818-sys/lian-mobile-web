import { formatRelativeTime } from "../time";

const NOW = new Date("2026-05-08T12:00:00Z").getTime();

function iso(msOffset: number) {
  return new Date(NOW - msOffset).toISOString();
}

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

// empty / invalid
assertEqual(formatRelativeTime("", NOW), "", "empty string");
assertEqual(formatRelativeTime(undefined, NOW), "", "undefined");
assertEqual(formatRelativeTime("not-a-date", NOW), "", "invalid date");

// 刚刚 boundary (< 60s)
assertEqual(formatRelativeTime(iso(0), NOW), "刚刚", "0ms");
assertEqual(formatRelativeTime(iso(59_999), NOW), "刚刚", "59999ms");

// minutes boundary (>= 60s, < 1h)
assertEqual(formatRelativeTime(iso(60_000), NOW), "1分钟前", "60s");
assertEqual(formatRelativeTime(iso(119_999), NOW), "1分钟前", "119999ms");
assertEqual(formatRelativeTime(iso(120_000), NOW), "2分钟前", "120s");
assertEqual(formatRelativeTime(iso(3_599_999), NOW), "59分钟前", "3599999ms");

// hours boundary (>= 1h, < 24h)
assertEqual(formatRelativeTime(iso(3_600_000), NOW), "1小时前", "1h");
assertEqual(formatRelativeTime(iso(7_199_999), NOW), "1小时前", "7199999ms");
assertEqual(formatRelativeTime(iso(7_200_000), NOW), "2小时前", "2h");
assertEqual(formatRelativeTime(iso(86_399_999), NOW), "23小时前", "86399999ms");

// yesterday boundary (>= 24h, < 48h)
assertEqual(formatRelativeTime(iso(86_400_000), NOW), "昨天", "24h");
assertEqual(formatRelativeTime(iso(172_799_999), NOW), "昨天", "172799999ms");

// days boundary (>= 48h, < 7d)
assertEqual(formatRelativeTime(iso(172_800_000), NOW), "2天前", "48h");
assertEqual(formatRelativeTime(iso(604_799_999), NOW), "6天前", "604799999ms");

// calendar date (>= 7d) — timezone-agnostic check
{
  const sevenDaysAgo = new Date(NOW - 604_800_000);
  const expected = `${sevenDaysAgo.getMonth() + 1}月${sevenDaysAgo.getDate()}日`;
  assertEqual(formatRelativeTime(iso(604_800_000), NOW), expected, "7d calendar");
}

// future date returns 刚刚 (negative diff)
const future = new Date(NOW + 1_000).toISOString();
assertEqual(formatRelativeTime(future, NOW), "刚刚", "future");

console.log("All formatRelativeTime tests passed.");
