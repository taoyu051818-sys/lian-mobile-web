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
