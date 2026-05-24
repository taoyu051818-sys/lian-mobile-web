import { apiGet, apiSend, LianApiError } from "./http";
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

export type AdminVerificationStatus = "pending" | "approved" | "rejected";
export type AdminVerificationDecisionStatus = "approved" | "rejected";
export type AdminVerificationType = "org-join" | "realname" | "merchant" | "runner";

// Discriminated union for the aggregate `publicSummary` payload returned by
// `GET /api/admin/verifications` and `PATCH /api/admin/verifications/:id`.
// Contract source: platform-server PR #518 (closes #511). The aggregate DTO
// never surfaces raw `submittedFields` or `payload`; all consumer-visible
// fields live under `publicSummary`, redacted by default for realname.
export interface AdminVerificationOrgJoinSummary {
  orgId?: string;
  orgName?: string;
  note?: string;
}

export interface AdminVerificationRealnameSummary {
  idType?: string;
  // Redacted by default — e.g. `张*`, `*1234`. Raw values only via the
  // explicit reveal endpoint (`GET .../realname/:id?reveal=true`).
  realName?: string;
  idNumber?: string;
  contact?: string;
}

export interface AdminVerificationMerchantSummary {
  merchantName?: string;
  note?: string;
}

export interface AdminVerificationRunnerSummary {
  note?: string;
}

export type AdminVerificationPublicSummary =
  | AdminVerificationOrgJoinSummary
  | AdminVerificationRealnameSummary
  | AdminVerificationMerchantSummary
  | AdminVerificationRunnerSummary;

export interface AdminVerificationRequest {
  verificationId: string;
  verificationType: AdminVerificationType;
  userId: string;
  status: AdminVerificationStatus;
  publicSummary?: AdminVerificationPublicSummary | null;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  reviewerNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminVerificationListResponse {
  items: AdminVerificationRequest[];
  total: number;
}

export interface AdminVerificationDetail {
  verificationId: string;
  verificationType?: AdminVerificationType | string;
  userId: string;
  status: AdminVerificationStatus | string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  reviewerNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  idType?: string | null;
  realName?: string | null;
  idNumber?: string | null;
  contact?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  note?: string | null;
  submittedFields?: Record<string, unknown> | null;
}

export interface AdminMeUser {
  id?: string;
  username?: string;
  roleIds?: string[];
}

export interface AdminMeResponse {
  ok: boolean;
  viaToken: boolean;
  user: AdminMeUser | null;
}

const ADMIN_SESSION_ROLES = new Set(["admin", "moderator"]);

export function isAdminMeRoleEligible(response: AdminMeResponse | null | undefined): boolean {
  if (!response?.ok) return false;
  if (response.viaToken) return true;
  const roleIds = response.user?.roleIds || [];
  return roleIds.some((role) =>
    ADMIN_SESSION_ROLES.has(
      String(role || "")
        .trim()
        .toLowerCase(),
    ),
  );
}

export async function fetchAdminMe(): Promise<AdminMeResponse> {
  return apiGet<AdminMeResponse>("/api/admin/me");
}

function withAuthHeader(token: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}

// Aggregate PATCH path — platform-server PR #518 (closes #511).
// One canonical route per verificationId regardless of channel; the backend
// resolves the channel from the id. Reserved channel segments
// (`org-join` / `realname` / `merchant` / `runner`) under
// `/api/admin/verifications/` return 400 by design, so the channel must
// never be sent as the path param.
function verificationAggregatePath(request: Pick<AdminVerificationRequest, "verificationId">) {
  return `/api/admin/verifications/${encodeURIComponent(request.verificationId)}`;
}

function verificationDetailPath(
  request: Pick<AdminVerificationRequest, "verificationId" | "verificationType">,
  options: { reveal?: boolean } = {},
) {
  if (request.verificationType !== "realname") {
    throw new Error("当前仅实名认证支持查看敏感明细。");
  }
  const search = new URLSearchParams();
  if (options.reveal) search.set("reveal", "true");
  const query = search.toString();
  const base = `/api/admin/verifications/realname/${encodeURIComponent(request.verificationId)}`;
  return query ? `${base}?${query}` : base;
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
  if (!data.report) throw new LianApiError("管理员后台未返回 report 数据", 0, "MALFORMED_RESPONSE");
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
    verificationType?: AdminVerificationType | "";
    userId?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminVerificationListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.verificationType) search.set("verificationType", params.verificationType);
  if (params.userId) search.set("userId", params.userId);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query ? `/api/admin/verifications?${query}` : "/api/admin/verifications";
  const data = await apiGet<{ items?: AdminVerificationRequest[]; total?: number }>(
    path,
    withAuthHeader(token),
  );
  return { items: data.items || [], total: data.total ?? data.items?.length ?? 0 };
}

export async function patchAdminVerificationRequest(
  token: string,
  request: Pick<AdminVerificationRequest, "verificationId" | "verificationType">,
  payload: {
    status: AdminVerificationDecisionStatus;
    reviewerNote?: string | null;
  },
): Promise<AdminVerificationDetail> {
  // Aggregate PATCH — one canonical call per decision regardless of channel.
  // Contract: platform-server PR #518 (closes ps#511). Backend resolves the
  // channel from `verificationId`; sending a channel segment as the path
  // param returns 400 (reserved-segment guard).
  const data = await apiSend<{ verification?: AdminVerificationDetail }>(
    verificationAggregatePath(request),
    withAuthHeader(token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
  if (!data.verification)
    throw new LianApiError("管理员后台未返回 verification 数据", 0, "MALFORMED_RESPONSE");
  return data.verification;
}

export async function fetchAdminVerificationDetail(
  token: string,
  request: Pick<AdminVerificationRequest, "verificationId" | "verificationType">,
  options: { reveal?: boolean } = {},
): Promise<AdminVerificationDetail> {
  const data = await apiGet<{ verification?: AdminVerificationDetail }>(
    verificationDetailPath(request, options),
    withAuthHeader(token),
  );
  if (!data.verification)
    throw new LianApiError("管理员后台未返回 verification 明细", 0, "MALFORMED_RESPONSE");
  return data.verification;
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
