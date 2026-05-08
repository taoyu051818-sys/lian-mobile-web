const MS_SECOND = 1_000;
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export function formatRelativeTime(value?: string, now = Date.now()): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = now - date.getTime();
  if (diff < MS_MINUTE) return "刚刚";
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MINUTE)}分钟前`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)}小时前`;
  if (diff < MS_DAY * 2) return "昨天";
  if (diff < MS_DAY * 7) return `${Math.floor(diff / MS_DAY)}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
