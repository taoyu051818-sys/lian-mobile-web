const MS_SECOND = 1_000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

function parseTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAbsoluteDate(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatRelativeTime(value?: string, now = Date.now()): string {
  const date = parseTimestamp(value);
  if (!date) return "";

  const diff = now - date.getTime();
  if (diff < 0) {
    return Math.abs(diff) < MS_MINUTE ? "刚刚" : formatAbsoluteDate(date);
  }
  if (diff < MS_MINUTE) return "刚刚";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MINUTE)}分钟前`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}小时前`;
  if (diff < MS_DAY * 2) return "昨天";
  if (diff < MS_DAY * 7) return `${Math.floor(diff / MS_DAY)}天前`;
  return formatAbsoluteDate(date);
}

// Prefer structured timestamps first and fall back to server-provided labels only for legacy payloads.
export function formatTimestampLabel(value?: string, fallbackLabel = "", now = Date.now()): string {
  return formatRelativeTime(value, now) || fallbackLabel;
}
