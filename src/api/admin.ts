import { apiGet, apiSend } from "./http";
import type {
  AdminAuditListResponse,
  AdminPostAction,
  AdminRealnameVerificationReveal,
  AdminReport,
  AdminReportListResponse,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
  AdminUserStatusResult,
  AdminVerificationDecisionStatus,
  AdminVerificationListResponse,
  AdminVerificationPublicSummary,
  AdminVerificationRecord,
  AdminVerificationStatus,
  AdminVerificationType,
} from "../types/admin";

function withAuthHeader(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}

function maskName(value: string): string {
  if (!value) return "";
  if (value.includes("*")) return value;
  return `${value.slice(0, 1)}${"*".repeat(Math.max(1, value.length - 1))}`;
}

function maskTrailing(value: string): string {
  if (!value) return "";
  if (value.includes("*")) return value;
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

function buildVerificationSummary(
  record: Record<string, unknown>,
  verificationType: AdminVerificationType,
): AdminVerificationPublicSummary {
  if (verificationType === "org-join") {
    return {
      orgId: record.orgId || "",
      orgName: record.orgName || "",
      note: record.note || "",
    };
  }
  if (verificationType === "realname") {
    return {
      idType: String(record.idType || ""),
      realName: maskName(String(record.realName || "")),
      idNumber: maskTrailing(String(record.idNumber || "")),
      contact: maskTrailing(String(record.contact || "")),
    };
  }
  if (record.publicSummary && typeof record.publicSummary === "object") {
    return record.publicSummary as AdminVerificationPublicSummary;
  }
  if (record.submittedFields && typeof record.submittedFields === "object") {
    return record.submittedFields as AdminVerificationPublicSummary;
  }
  return {};
}

function normalizeVerificationRecord(
  input: Record<string, unknown>,
  fallbackType?: AdminVerificationType,
): AdminVerificationRecord {
  const verificationType = String(
    input.verificationType || fallbackType || "merchant",
  ) as AdminVerificationType;
  return {
    verificationId: String(input.verificationId || ""),
    verificationType,
    userId: String(input.userId || ""),
    status: String(input.status || "pending") as AdminVerificationStatus,
    publicSummary: buildVerificationSummary(input, verificationType),
    reviewerId: input.reviewerId ? String(input.reviewerId) : null,
    reviewedAt: input.reviewedAt ? String(input.reviewedAt) : null,
    reviewerNote: input.reviewerNote ? String(input.reviewerNote) : null,
    createdAt: String(input.createdAt || input.updatedAt || ""),
    updatedAt: String(input.updatedAt || input.createdAt || ""),
  };
}

function verificationTransitionPath(request: {
  verificationId: string;
  verificationType: AdminVerificationType;
}): string {
  return `/api/admin/verifications/${request.verificationType}/${encodeURIComponent(request.verificationId)}`;
}

export async function fetchAdminReports(
  token: string,
  params: {
    status?: AdminReportStatus | "";
    targetType?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminReportListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.targetType) search.set("targetType", params.targetType);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query ? `/api/admin/reports?${query}` : "/api/admin/reports";
  const data = await apiGet<{ items?: AdminReport[]; total?: number }>(path, withAuthHeader(token));
  return { items: data.items || [], total: data.total ?? data.items?.length ?? 0 };
}

export async function patchAdminReport(
  token: string,
  reportId: string,
  payload: {
    status: AdminReportTransitionStatus;
    action?: string | null;
    note?: string | null;
  },
): Promise<AdminReport> {
  const data = await apiSend<{ report?: AdminReport }>(
    `/api/admin/reports/${encodeURIComponent(reportId)}`,
    withAuthHeader(token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
  if (!data.report) throw new Error("管理员后台未返回 report 数据");
  return data.report;
}

export async function postAdminPostAction(
  token: string,
  tid: number,
  action: AdminPostAction,
): Promise<void> {
  await apiSend(
    `/api/admin/posts/${encodeURIComponent(String(tid))}/${action}`,
    withAuthHeader(token, { method: "POST" }),
  );
}

export async function patchAdminUserStatus(
  token: string,
  userIdOrEmail: string,
  payload: { status: AdminUserStatus; reason?: string },
): Promise<AdminUserStatusResult> {
  const data = await apiSend<{
    user?: {
      id?: string;
      status?: AdminUserStatus;
      statusReason?: string;
      statusChangedAt?: string;
    };
  }>(
    `/api/admin/auth/users/${encodeURIComponent(userIdOrEmail)}/status`,
    withAuthHeader(token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
  return {
    userId: data.user?.id || userIdOrEmail,
    status: (data.user?.status as AdminUserStatus) || payload.status,
    statusReason: data.user?.statusReason || payload.reason || "",
    statusChangedAt: data.user?.statusChangedAt || new Date().toISOString(),
  };
}

export async function fetchAdminVerifications(
  token: string,
  params: {
    verificationType?: AdminVerificationType | "";
    status?: AdminVerificationStatus | "";
    userId?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminVerificationListResponse> {
  const search = new URLSearchParams();
  if (params.verificationType) search.set("verificationType", params.verificationType);
  if (params.status) search.set("status", params.status);
  if (params.userId) search.set("userId", params.userId);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query ? `/api/admin/verifications?${query}` : "/api/admin/verifications";
  const data = await apiGet<{ items?: Record<string, unknown>[]; total?: number }>(
    path,
    withAuthHeader(token),
  );
  const items = (data.items || []).map((item) => normalizeVerificationRecord(item));
  return { items, total: data.total ?? items.length };
}

export async function patchAdminVerification(
  token: string,
  request: Pick<AdminVerificationRecord, "verificationId" | "verificationType">,
  payload: {
    status: AdminVerificationDecisionStatus;
    reviewerNote?: string | null;
  },
): Promise<AdminVerificationRecord> {
  const data = await apiSend<{ verification?: Record<string, unknown> }>(
    verificationTransitionPath(request),
    withAuthHeader(token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
  if (!data.verification) throw new Error("管理员后台未返回 verification 数据");
  return normalizeVerificationRecord(data.verification, request.verificationType);
}

export async function fetchAdminRealnameVerificationReveal(
  token: string,
  verificationId: string,
): Promise<AdminRealnameVerificationReveal> {
  const data = await apiGet<{ verification?: Record<string, unknown> }>(
    `/api/admin/verifications/realname/${encodeURIComponent(verificationId)}?reveal=true`,
    withAuthHeader(token),
  );
  if (!data.verification) throw new Error("管理员后台未返回实名数据");
  return {
    verificationId: String(data.verification.verificationId || verificationId),
    userId: String(data.verification.userId || ""),
    status: String(data.verification.status || "pending") as AdminVerificationStatus,
    idType: String(data.verification.idType || ""),
    realName: String(data.verification.realName || ""),
    idNumber: String(data.verification.idNumber || ""),
    contact: String(data.verification.contact || ""),
    reviewerId: data.verification.reviewerId ? String(data.verification.reviewerId) : null,
    reviewedAt: data.verification.reviewedAt ? String(data.verification.reviewedAt) : null,
    reviewerNote: data.verification.reviewerNote ? String(data.verification.reviewerNote) : null,
    createdAt: String(data.verification.createdAt || data.verification.updatedAt || ""),
    updatedAt: String(data.verification.updatedAt || data.verification.createdAt || ""),
  };
}

export async function fetchAdminAuditLog(
  token: string,
  params: { actorId?: string; action?: string; limit?: number; offset?: number } = {},
): Promise<AdminAuditListResponse> {
  const search = new URLSearchParams();
  if (params.actorId) search.set("actorId", params.actorId);
  if (params.action) search.set("action", params.action);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query ? `/api/admin/audit-log?${query}` : "/api/admin/audit-log";
  const data = await apiGet<AdminAuditListResponse>(path, withAuthHeader(token));
  return { items: data.items || [], total: data.total ?? data.items?.length ?? 0 };
}
