export type AdminReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export type AdminReportTransitionStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export type AdminReportAction =
  | "ignore"
  | "hide_post"
  | "restrict_author"
  | "ban_user"
  | "restore_post"
  | "mark_false_report";

export interface AdminReport {
  reportId: string;
  targetType: string;
  targetId: string;
  pid: number | null;
  actorId: string;
  reason: string;
  status: AdminReportStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  action: AdminReportAction | string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportListResponse {
  items: AdminReport[];
  total: number;
}

export interface AdminAuditEvent {
  eventId: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminAuditListResponse {
  items: AdminAuditEvent[];
  total: number;
}

export type AdminPostAction = "hide" | "lock" | "unlock";

export type AdminUserStatus = "active" | "limited" | "banned";

export interface AdminUserStatusResult {
  userId: string;
  status: AdminUserStatus;
  statusReason: string;
  statusChangedAt: string;
}
