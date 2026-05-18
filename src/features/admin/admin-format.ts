import {
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
  ignored: ADMIN_STATUS_DISMISSED,
  handled: ADMIN_STATUS_RESOLVED,
  hidden: ADMIN_STATUS_RESOLVED,
  restricted: ADMIN_STATUS_RESOLVED,
  banned: ADMIN_STATUS_RESOLVED,
  restored: ADMIN_STATUS_RESOLVED,
  false_report: ADMIN_STATUS_DISMISSED,
};

export function adminStatusLabel(status: AdminReportStatus | string): string {
  return STATUS_LABEL_MAP[status] || ADMIN_STATUS_FALLBACK;
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
