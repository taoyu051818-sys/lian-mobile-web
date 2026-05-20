export type AdminReportStatus =
  | "pending"
  | "reviewing"
  | "resolved"
  | "dismissed"
  | "ignored"
  | "handled"
  | "hidden"
  | "restricted"
  | "banned"
  | "restored"
  | "false_report";

export type AdminReportTransitionStatus = "pending" | "reviewing" | "resolved" | "dismissed";

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
  action: string | null;
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

export type AdminVerificationType = "org-join" | "realname" | "merchant" | "runner";

export type AdminVerificationStatus = "pending" | "approved" | "rejected";

export type AdminVerificationDecisionStatus = "approved" | "rejected";

export type AdminVerificationPublicSummary = Record<string, unknown>;

export interface AdminVerificationRecord {
  verificationId: string;
  verificationType: AdminVerificationType;
  userId: string;
  status: AdminVerificationStatus;
  publicSummary: AdminVerificationPublicSummary;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVerificationListResponse {
  items: AdminVerificationRecord[];
  total: number;
}

export interface AdminRealnameVerificationReveal {
  verificationId: string;
  userId: string;
  status: AdminVerificationStatus;
  idType: string;
  realName: string;
  idNumber: string;
  contact: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
}