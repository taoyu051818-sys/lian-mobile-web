import { ref } from "vue";
import {
  fetchAdminAuditLog,
  fetchAdminRealnameVerificationReveal,
  fetchAdminReports,
  fetchAdminVerifications,
  patchAdminReport,
  patchAdminUserStatus,
  patchAdminVerification,
  postAdminPostAction,
} from "../../api/admin";
import { LianApiError } from "../../api/http";
import {
  ADMIN_ACTION_FAIL,
  ADMIN_AUDIT_LOAD_ERROR,
  ADMIN_QUEUE_LOAD_ERROR,
  ADMIN_TOKEN_INVALID,
  ADMIN_VERIFICATION_QUEUE_LOAD_ERROR,
} from "../../config/brand";
import type {
  AdminAuditEvent,
  AdminPostAction,
  AdminRealnameVerificationReveal,
  AdminReport,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
  AdminVerificationDecisionStatus,
  AdminVerificationRecord,
  AdminVerificationStatus,
} from "../../types/admin";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

interface UseAdminConsoleOptions {
  token: { value: string };
  onTokenInvalid: () => void;
}

export function useAdminConsole({ token, onTokenInvalid }: UseAdminConsoleOptions) {
  const reports = ref<AdminReport[]>([]);
  const reportsLoading = ref(false);
  const reportsError = ref("");
  const reportsTotal = ref(0);

  const auditEvents = ref<AdminAuditEvent[]>([]);
  const auditLoading = ref(false);
  const auditError = ref("");

  const verificationRequests = ref<AdminVerificationRecord[]>([]);
  const verificationLoading = ref(false);
  const verificationError = ref("");
  const verificationTotal = ref(0);
  const revealedRealnames = ref<Record<string, AdminRealnameVerificationReveal | undefined>>({});
  const revealLoadingIds = ref<Record<string, boolean>>({});

  const actionMessage = ref("");
  const actionError = ref("");

  function clearMessages() {
    actionMessage.value = "";
    actionError.value = "";
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
    if (!token.value) return;
    reportsLoading.value = true;
    reportsError.value = "";
    try {
      const data = await fetchAdminReports(token.value, { status, limit: 100 });
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
    if (!token.value) return;
    auditLoading.value = true;
    auditError.value = "";
    try {
      const data = await fetchAdminAuditLog(token.value, { limit: 100 });
      auditEvents.value = data.items;
    } catch (error) {
      if (handleAuthError(error)) return;
      auditError.value = extractErrorMessage(error, ADMIN_AUDIT_LOAD_ERROR);
    } finally {
      auditLoading.value = false;
    }
  }

  async function loadVerificationRequests(status: AdminVerificationStatus | "" = "pending") {
    if (!token.value) return;
    verificationLoading.value = true;
    verificationError.value = "";
    try {
      const data = await fetchAdminVerifications(token.value, { status, limit: 100 });
      verificationRequests.value = data.items;
      verificationTotal.value = data.total;
    } catch (error) {
      if (handleAuthError(error)) return;
      verificationError.value = extractErrorMessage(error, ADMIN_VERIFICATION_QUEUE_LOAD_ERROR);
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
    if (!token.value) return false;
    clearMessages();
    try {
      const updated = await patchAdminReport(token.value, reportId, payload);
      const idx = reports.value.findIndex((report) => report.reportId === updated.reportId);
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
    if (!token.value) return false;
    clearMessages();
    try {
      await postAdminPostAction(token.value, tid, action);
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
    if (!token.value) return false;
    clearMessages();
    try {
      await patchAdminUserStatus(token.value, userIdOrEmail, payload);
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function reviewVerificationRequest(
    request: AdminVerificationRecord,
    payload: {
      status: AdminVerificationDecisionStatus;
      reviewerNote?: string | null;
    },
    activeStatus: AdminVerificationStatus | "" = "",
  ) {
    if (!token.value) return false;
    clearMessages();
    try {
      const updated = await patchAdminVerification(token.value, request, payload);
      const idx = verificationRequests.value.findIndex(
        (item) => item.verificationId === request.verificationId,
      );
      if (activeStatus && updated.status !== activeStatus) {
        verificationRequests.value = verificationRequests.value.filter(
          (item) => item.verificationId !== request.verificationId,
        );
        verificationTotal.value = Math.max(0, verificationTotal.value - 1);
      } else if (idx >= 0) {
        verificationRequests.value[idx] = updated;
      }
      if (request.verificationType === "realname") {
        delete revealedRealnames.value[request.verificationId];
      }
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function loadRealnameReveal(verificationId: string) {
    if (!token.value || revealLoadingIds.value[verificationId]) return false;
    clearMessages();
    revealLoadingIds.value = { ...revealLoadingIds.value, [verificationId]: true };
    try {
      const revealed = await fetchAdminRealnameVerificationReveal(token.value, verificationId);
      revealedRealnames.value = {
        ...revealedRealnames.value,
        [verificationId]: revealed,
      };
      return true;
    } catch (error) {
      if (handleAuthError(error)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    } finally {
      revealLoadingIds.value = { ...revealLoadingIds.value, [verificationId]: false };
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
    revealedRealnames,
    revealLoadingIds,
    actionMessage,
    actionError,
    clearMessages,
    loadReports,
    loadAuditLog,
    loadVerificationRequests,
    transitionReport,
    applyPostAction,
    applyUserStatus,
    reviewVerificationRequest,
    loadRealnameReveal,
  };
}
