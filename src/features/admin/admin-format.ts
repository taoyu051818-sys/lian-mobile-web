import {
  ADMIN_ACTION_POST_HIDE,
  ADMIN_ACTION_POST_UNLOCK,
  ADMIN_ACTION_USER_STATUS_LABEL,
  ADMIN_STATUS_DISMISSED,
  ADMIN_STATUS_FALLBACK,
  ADMIN_STATUS_PENDING,
  ADMIN_STATUS_RESOLVED,
  ADMIN_STATUS_REVIEWING,
} from "../../config/brand";
import type { AdminReportStatus } from "../../types/admin";

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: ADMIN_STATUS_PENDING,
  reviewing: ADMIN_STATUS_REVIEWING,
  resolved: ADMIN_STATUS_RESOLVED,
  dismissed: ADMIN_STATUS_DISMISSED,
};

const ACTION_LABEL_MAP: Record<string, string> = {
  ignore: "忽略举报",
  hide_post: ADMIN_ACTION_POST_HIDE,
  restrict_author: `${ADMIN_ACTION_USER_STATUS_LABEL}：限号`,
  ban_user: `${ADMIN_ACTION_USER_STATUS_LABEL}：封号`,
  restore_post: ADMIN_ACTION_POST_UNLOCK,
  mark_false_report: "标记误报",
};

export function adminStatusLabel(status: AdminReportStatus | string): string {
  return STATUS_LABEL_MAP[status] || ADMIN_STATUS_FALLBACK;
}

export function adminActionLabel(action: string | null | undefined): string {
  if (!action) return "";
  return ACTION_LABEL_MAP[action] || action;
}

export function formatAdminTime(value: string | null | undefined): string {
  if (!value) return "";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  const date = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
