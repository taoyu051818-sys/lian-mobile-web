import { ref } from "vue";
import { LianApiError } from "../../api/http";
import {
  fetchAdminAuditLog,
  fetchAdminVerificationDetail,
  fetchAdminVerificationRequests,
  fetchAdminReports,
  patchAdminReport,
  patchAdminUserStatus,
  patchAdminVerificationRequest,
  postAdminPostAction,
  type AdminVerificationDecisionStatus,
  type AdminVerificationDetail,
  type AdminVerificationRequest,
  type AdminVerificationStatus,
} from "../../api/admin";
import {
  createAdminAuthLink,
  fetchAdminAuthLinks,
  revokeAdminAuthLink,
  type AuthLink,
  type AuthLinkCreatePayload,
} from "../../api/adminAuthLink";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  ADMIN_ACTION_FAIL,
  ADMIN_AUDIT_LOAD_ERROR,
  ADMIN_AUTH_LINK_LOAD_ERROR,
  ADMIN_QUEUE_LOAD_ERROR,
  ADMIN_TOKEN_INVALID,
} from "../../config/brand";
import type {
  AdminAuditEvent,
  AdminPostAction,
  AdminReport,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
} from "../../types/admin";

interface UseAdminConsoleOptions {
  token: { value: string };
  sessionAdmin: { value: boolean };
  onTokenInvalid: () => void;
}

export function useAdminConsole({ token, sessionAdmin, onTokenInvalid }: UseAdminConsoleOptions) {
  function hasAdminAccess() {
    return sessionAdmin.value || Boolean(token.value);
  }

  function currentToken() {
    return sessionAdmin.value ? "" : token.value;
  }
  const reports = ref<AdminReport[]>([]);
  const reportsLoading = ref(false);
  const reportsError = ref("");
  const reportsTotal = ref(0);

  const auditEvents = ref<AdminAuditEvent[]>([]);
  const auditLoading = ref(false);
  const auditError = ref("");

  const verificationRequests = ref<AdminVerificationRequest[]>([]);
  const verificationLoading = ref(false);
  const verificationError = ref("");
  const verificationTotal = ref(0);
  const verificationStatusFilter = ref<AdminVerificationStatus | "">("pending");
  const revealedVerificationDetails = ref<Record<string, AdminVerificationDetail | undefined>>({});
  const revealingVerificationId = ref("");
  const verificationRevealError = ref("");

  const actionMessage = ref("");
  const actionError = ref("");

  const authLinks = ref<AuthLink[]>([]);
  const authLinksLoading = ref(false);
  const authLinksError = ref("");
  const authLinkCreating = ref(false);
  const authLinkCreateError = ref("");

  function clearMessages() {
    actionMessage.value = "";
    actionError.value = "";
    verificationRevealError.value = "";
    authLinkCreateError.value = "";
  }

  function handleAuthError(error: unknown): boolean {
    if (error instanceof LianApiError && (error.status === 401 || error.status === 403)) {
      onTokenInvalid();
      actionError.value = ADMIN_TOKEN_INVALID;
      return true;
    }
    return false;
  }

  async function loadReports(status: AdminReportStatus | "" = "") {
    if (!hasAdminAccess()) return;
    reportsLoading.value = true;
    reportsError.value = "";
    try {
      const data = await fetchAdminReports(currentToken(), { status, limit: 100 });
      reports.value = data.items;
      reportsTotal.value = data.total;
    } catch (error) {
      if (handleAuthError(error)) return;
      reportsError.value = extractErrorMessage(error, ADMIN_QUEUE_LOAD_ERROR);
    } finally {
      reportsLoading.value = false;
    }
  }

  async function loadAuditLog() {
    if (!hasAdminAccess()) return;
    auditLoading.value = true;
    auditError.value = "";
    try {
      const data = await fetchAdminAuditLog(currentToken(), { limit: 100 });
      auditEvents.value = data.items;
    } catch (error) {
      if (handleAuthError(error)) return;
      auditError.value = extractErrorMessage(error, ADMIN_AUDIT_LOAD_ERROR);
    } finally {
      auditLoading.value = false;
    }
  }

  async function loadVerificationRequests(status: AdminVerificationStatus | "" = "pending") {
    if (!hasAdminAccess()) return;
    verificationStatusFilter.value = status;
    verificationLoading.value = true;
    verificationError.value = "";
    verificationRevealError.value = "";
    revealedVerificationDetails.value = {};
    try {
      const data = await fetchAdminVerificationRequests(currentToken(), { status, limit: 100 });
      verificationRequests.value = data.items;
      verificationTotal.value = data.total;
    } catch (error) {
      if (handleAuthError(error)) return;
      verificationError.value = extractErrorMessage(error, "认证审核队列加载失败，可以稍后再试。");
    } finally {
      verificationLoading.value = false;
    }
  }

  async function transitionReport(
    reportId: string,
    payload: {
      status: AdminReportTransitionStatus;
      action?: string | null;
      note?: string | null;
    },
  ) {
    if (!hasAdminAccess()) return false;
    clearMessages();
    try {
      const updated = await patchAdminReport(currentToken(), reportId, payload);
      const idx = reports.value.findIndex((r) => r.reportId === updated.reportId);
      if (idx >= 0) reports.value[idx] = updated;
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function applyPostAction(tid: number, action: AdminPostAction) {
    if (!hasAdminAccess()) return false;
    clearMessages();
    try {
      await postAdminPostAction(currentToken(), tid, action);
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function applyUserStatus(
    userIdOrEmail: string,
    payload: { status: AdminUserStatus; reason?: string },
  ) {
    if (!hasAdminAccess()) return false;
    clearMessages();
    try {
      await patchAdminUserStatus(currentToken(), userIdOrEmail, payload);
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function reviewVerificationRequest(
    request: AdminVerificationRequest,
    payload: { status: AdminVerificationDecisionStatus; reviewerNote?: string | null },
  ) {
    if (!hasAdminAccess()) return false;
    clearMessages();
    try {
      await patchAdminVerificationRequest(currentToken(), request, payload);
      await loadVerificationRequests(verificationStatusFilter.value);
      actionMessage.value = "认证审核结果已提交。";
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function revealVerificationRequest(request: AdminVerificationRequest) {
    if (!hasAdminAccess() || request.verificationType !== "realname") return null;
    verificationRevealError.value = "";
    revealingVerificationId.value = request.verificationId;
    try {
      const detail = await fetchAdminVerificationDetail(currentToken(), request, { reveal: true });
      revealedVerificationDetails.value = {
        ...revealedVerificationDetails.value,
        [request.verificationId]: detail,
      };
      actionMessage.value = "已通过后端审计路径读取实名认证明细。";
      return detail;
    } catch (error) {
      if (handleAuthError(error)) return null;
      verificationRevealError.value = extractErrorMessage(
        error,
        "实名认证明细暂时无法读取，可以稍后再试。",
      );
      return null;
    } finally {
      revealingVerificationId.value = "";
    }
  }

  async function loadAuthLinks() {
    if (!hasAdminAccess()) return;
    authLinksLoading.value = true;
    authLinksError.value = "";
    try {
      const data = await fetchAdminAuthLinks(currentToken());
      authLinks.value = data.items;
    } catch (error) {
      if (handleAuthError(error)) return;
      authLinksError.value = extractErrorMessage(error, ADMIN_AUTH_LINK_LOAD_ERROR);
    } finally {
      authLinksLoading.value = false;
    }
  }

  async function createAuthLink(payload: AuthLinkCreatePayload) {
    if (!hasAdminAccess()) return null;
    clearMessages();
    authLinkCreating.value = true;
    authLinkCreateError.value = "";
    try {
      const link = await createAdminAuthLink(currentToken(), payload);
      await loadAuthLinks();
      actionMessage.value = "邀请链接已创建。";
      return link;
    } catch (error) {
      if (handleAuthError(error)) return null;
      authLinkCreateError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return null;
    } finally {
      authLinkCreating.value = false;
    }
  }

  async function revokeAuthLink(linkToken: string) {
    if (!hasAdminAccess()) return false;
    clearMessages();
    try {
      await revokeAdminAuthLink(currentToken(), linkToken);
      await loadAuthLinks();
      actionMessage.value = "邀请链接已撤销。";
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  return {
    reports,
    reportsLoading,
    reportsError,
    reportsTotal,
    auditEvents,
    auditLoading,
    auditError,
    verificationRequests,
    verificationLoading,
    verificationError,
    verificationTotal,
    verificationStatusFilter,
    revealedVerificationDetails,
    revealingVerificationId,
    verificationRevealError,
    authLinks,
    authLinksLoading,
    authLinksError,
    authLinkCreating,
    authLinkCreateError,
    actionMessage,
    actionError,
    clearMessages,
    loadReports,
    loadAuditLog,
    loadVerificationRequests,
    loadAuthLinks,
    createAuthLink,
    revokeAuthLink,
    transitionReport,
    applyPostAction,
    applyUserStatus,
    reviewVerificationRequest,
    revealVerificationRequest,
  };
}
