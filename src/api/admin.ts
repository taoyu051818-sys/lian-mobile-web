import { apiGet, apiSend } from "./http";
import type {
  AdminAuditListResponse,
  AdminPostAction,
  AdminReport,
  AdminReportListResponse,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
  AdminUserStatusResult,
} from "../types/admin";
import type { VerificationTag } from "../types/verification";

export type AdminVerificationStatus = "pending" | "reviewing" | "approved" | "rejected";
export type AdminVerificationDecisionStatus = "approved" | "rejected";

export interface AdminVerificationRequest {
  requestId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  tag: VerificationTag;
  status: AdminVerificationStatus;
  payload?: Record<string, unknown> | null;
  note?: string | null;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminVerificationListResponse {
  items: AdminVerificationRequest[];
  total: number;
}

function withAuthHeader(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
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

export async function fetchAdminVerificationRequests(
  token: string,
  params: {
    status?: AdminVerificationStatus | "";
    tag?: VerificationTag | "";
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminVerificationListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.tag) search.set("tag", params.tag);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query ? `/api/admin/verifications?${query}` : "/api/admin/verifications";
  const data = await apiGet<{
    items?: AdminVerificationRequest[];
    requests?: AdminVerificationRequest[];
    total?: number;
  }>(path, withAuthHeader(token));
  const items = data.items || data.requests || [];
  return { items, total: data.total ?? items.length };
}

export async function patchAdminVerificationRequest(
  token: string,
  requestId: string,
  payload: {
    status: AdminVerificationDecisionStatus;
    note?: string | null;
  },
): Promise<AdminVerificationRequest> {
  const data = await apiSend<{
    request?: AdminVerificationRequest;
    verification?: AdminVerificationRequest;
  }>(
    `/api/admin/verifications/${encodeURIComponent(requestId)}`,
    withAuthHeader(token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
  const request = data.request || data.verification;
  if (!request) throw new Error("管理员后台未返回 verification request 数据");
  return request;
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
