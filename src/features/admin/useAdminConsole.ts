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
  lane: { value: string };
  authEpoch: { value: number };
  onTokenInvalid: () => void;
}

type OperationKey =
  | "loadReports"
  | "loadAuditLog"
  | "loadVerificationRequests"
  | "loadAuthLinks"
  | "transitionReport"
  | "applyPostAction"
  | "applyUserStatus"
  | "reviewVerificationRequest"
  | "revealVerificationRequest"
  | "createAuthLink"
  | "revokeAuthLink";

interface OperationOwner {
  key: OperationKey;
  sequence: number;
  token: string;
  authEpoch: number;
  lifecycle: number;
  authorizationVersion: number;
}

interface LoadingLease {
  requestOwner: OperationOwner;
  parentOuter?: OperationOwner;
}

export function useAdminConsole({
  token,
  lane,
  authEpoch,
  onTokenInvalid,
}: UseAdminConsoleOptions) {
  const operationSequences: Record<OperationKey, number> = {
    loadReports: 0,
    loadAuditLog: 0,
    loadVerificationRequests: 0,
    loadAuthLinks: 0,
    transitionReport: 0,
    applyPostAction: 0,
    applyUserStatus: 0,
    reviewVerificationRequest: 0,
    revealVerificationRequest: 0,
    createAuthLink: 0,
    revokeAuthLink: 0,
  };
  let disposed = false;
  let lifecycle = 0;
  let authorizationVersion = 0;

  function ownsSequence(owner: OperationOwner) {
    return (
      !disposed && owner.lifecycle === lifecycle && operationSequences[owner.key] === owner.sequence
    );
  }

  function isCurrent(owner: OperationOwner, parent?: OperationOwner): boolean {
    return (
      ownsSequence(owner) &&
      owner.authorizationVersion === authorizationVersion &&
      lane.value === "ops" &&
      authEpoch.value === owner.authEpoch &&
      token.value.trim() === owner.token &&
      (!parent || isCurrent(parent))
    );
  }

  function beginOperation(key: OperationKey, parent?: OperationOwner): OperationOwner | null {
    if (disposed || lane.value !== "ops" || (parent && !isCurrent(parent))) return null;
    const bearerToken = token.value.trim();
    if (!bearerToken) return null;
    const sequence = operationSequences[key] + 1;
    operationSequences[key] = sequence;
    return {
      key,
      sequence,
      token: bearerToken,
      authEpoch: authEpoch.value,
      lifecycle,
      authorizationVersion,
    };
  }

  function handleCurrentAuthError(
    error: unknown,
    owner: OperationOwner,
    parent?: OperationOwner,
  ): boolean {
    const authorizationLost =
      error instanceof LianApiError && (error.status === 401 || error.status === 403);
    if (!authorizationLost || !isCurrent(owner, parent)) {
      return false;
    }
    retireOperationOwners();
    clearEphemeral();
    authorizationVersion += 1;
    onTokenInvalid();
    return true;
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

  let verificationLoadingLease: LoadingLease | null = null;
  let authLinksLoadingLease: LoadingLease | null = null;

  function captureSupersededNestedLoadingLease(
    lease: LoadingLease | null,
    successor: OperationOwner,
  ): LoadingLease | null {
    const parent = lease?.parentOuter;
    if (!parent || parent.key !== successor.key || isCurrent(parent)) return null;
    return lease;
  }

  function releaseVerificationLoadingLease(lease: LoadingLease | null) {
    if (!lease || verificationLoadingLease !== lease) return;
    verificationLoadingLease = null;
    verificationLoading.value = false;
  }

  function releaseAuthLinksLoadingLease(lease: LoadingLease | null) {
    if (!lease || authLinksLoadingLease !== lease) return;
    authLinksLoadingLease = null;
    authLinksLoading.value = false;
  }

  function retireOperationOwners() {
    for (const key of Object.keys(operationSequences) as OperationKey[]) {
      operationSequences[key] += 1;
    }
  }

  function clearEphemeral() {
    reports.value = [];
    reportsLoading.value = false;
    reportsError.value = "";
    reportsTotal.value = 0;
    auditEvents.value = [];
    auditLoading.value = false;
    auditError.value = "";
    verificationRequests.value = [];
    verificationLoadingLease = null;
    verificationLoading.value = false;
    verificationError.value = "";
    verificationTotal.value = 0;
    verificationStatusFilter.value = "pending";
    revealedVerificationDetails.value = {};
    revealingVerificationId.value = "";
    verificationRevealError.value = "";
    actionMessage.value = "";
    actionError.value = "";
    authLinks.value = [];
    authLinksLoadingLease = null;
    authLinksLoading.value = false;
    authLinksError.value = "";
    authLinkCreating.value = false;
    authLinkCreateError.value = "";
  }

  function clearMessages() {
    actionMessage.value = "";
    actionError.value = "";
    verificationRevealError.value = "";
    authLinkCreateError.value = "";
  }

  async function loadReports(status: AdminReportStatus | "" = "") {
    const owner = beginOperation("loadReports");
    if (!owner) return;
    reportsLoading.value = true;
    reportsError.value = "";
    try {
      const data = await fetchAdminReports(owner.token, { status, limit: 100 });
      if (!isCurrent(owner)) return;
      reports.value = data.items;
      reportsTotal.value = data.total;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return;
      reportsError.value = extractErrorMessage(error, ADMIN_QUEUE_LOAD_ERROR);
    } finally {
      if (isCurrent(owner)) reportsLoading.value = false;
    }
  }

  async function loadAuditLog() {
    const owner = beginOperation("loadAuditLog");
    if (!owner) return;
    auditLoading.value = true;
    auditError.value = "";
    try {
      const data = await fetchAdminAuditLog(owner.token, { limit: 100 });
      if (!isCurrent(owner)) return;
      auditEvents.value = data.items;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return;
      auditError.value = extractErrorMessage(error, ADMIN_AUDIT_LOAD_ERROR);
    } finally {
      if (isCurrent(owner)) auditLoading.value = false;
    }
  }

  async function loadVerificationRequestsOwned(
    status: AdminVerificationStatus | "" = "pending",
    parent?: OperationOwner,
  ) {
    const owner = beginOperation("loadVerificationRequests", parent);
    if (!owner) return;
    const loadingLease: LoadingLease = { requestOwner: owner, parentOuter: parent };
    verificationLoadingLease = loadingLease;
    verificationStatusFilter.value = status;
    verificationLoading.value = true;
    verificationError.value = "";
    verificationRevealError.value = "";
    revealedVerificationDetails.value = {};
    try {
      const data = await fetchAdminVerificationRequests(owner.token, { status, limit: 100 });
      if (!isCurrent(owner, parent)) return;
      verificationRequests.value = data.items;
      verificationTotal.value = data.total;
    } catch (error) {
      if (!isCurrent(owner, parent) || handleCurrentAuthError(error, owner, parent)) return;
      verificationError.value = extractErrorMessage(error, "认证审核队列加载失败，可以稍后再试。");
    } finally {
      if (
        verificationLoadingLease === loadingLease &&
        isCurrent(loadingLease.requestOwner, loadingLease.parentOuter)
      ) {
        releaseVerificationLoadingLease(loadingLease);
      }
    }
  }

  async function loadVerificationRequests(status: AdminVerificationStatus | "" = "pending") {
    await loadVerificationRequestsOwned(status);
  }

  async function transitionReport(
    reportId: string,
    payload: {
      status: AdminReportTransitionStatus;
      action?: string | null;
      note?: string | null;
    },
  ) {
    const owner = beginOperation("transitionReport");
    if (!owner) return false;
    clearMessages();
    try {
      const updated = await patchAdminReport(owner.token, reportId, payload);
      if (!isCurrent(owner)) return false;
      const idx = reports.value.findIndex((r) => r.reportId === updated.reportId);
      if (idx >= 0) reports.value[idx] = updated;
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function applyPostAction(tid: number, action: AdminPostAction) {
    const owner = beginOperation("applyPostAction");
    if (!owner) return false;
    clearMessages();
    try {
      await postAdminPostAction(owner.token, tid, action);
      if (!isCurrent(owner)) return false;
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function applyUserStatus(
    userIdOrEmail: string,
    payload: { status: AdminUserStatus; reason?: string },
  ) {
    const owner = beginOperation("applyUserStatus");
    if (!owner) return false;
    clearMessages();
    try {
      await patchAdminUserStatus(owner.token, userIdOrEmail, payload);
      if (!isCurrent(owner)) return false;
      actionMessage.value = "操作已生效。";
      return true;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return false;
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function reviewVerificationRequest(
    request: AdminVerificationRequest,
    payload: { status: AdminVerificationDecisionStatus; reviewerNote?: string | null },
  ) {
    const owner = beginOperation("reviewVerificationRequest");
    if (!owner) return false;
    const inheritedLoadingLease = captureSupersededNestedLoadingLease(
      verificationLoadingLease,
      owner,
    );
    clearMessages();
    try {
      await patchAdminVerificationRequest(owner.token, request, payload);
      if (!isCurrent(owner)) return false;
      await loadVerificationRequestsOwned(verificationStatusFilter.value, owner);
      if (!isCurrent(owner)) return false;
      actionMessage.value = "认证审核结果已提交。";
      return true;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return false;
      releaseVerificationLoadingLease(inheritedLoadingLease);
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  async function revealVerificationRequest(request: AdminVerificationRequest) {
    if (request.verificationType !== "realname") return null;
    const owner = beginOperation("revealVerificationRequest");
    if (!owner) return null;
    verificationRevealError.value = "";
    revealingVerificationId.value = request.verificationId;
    try {
      const detail = await fetchAdminVerificationDetail(owner.token, request, { reveal: true });
      if (!isCurrent(owner)) return null;
      revealedVerificationDetails.value = {
        ...revealedVerificationDetails.value,
        [request.verificationId]: detail,
      };
      actionMessage.value = "已通过后端审计路径读取实名认证明细。";
      return detail;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return null;
      verificationRevealError.value = extractErrorMessage(
        error,
        "实名认证明细暂时无法读取，可以稍后再试。",
      );
      return null;
    } finally {
      if (isCurrent(owner)) revealingVerificationId.value = "";
    }
  }

  async function loadAuthLinksOwned(parent?: OperationOwner) {
    const owner = beginOperation("loadAuthLinks", parent);
    if (!owner) return;
    const loadingLease: LoadingLease = { requestOwner: owner, parentOuter: parent };
    authLinksLoadingLease = loadingLease;
    authLinksLoading.value = true;
    authLinksError.value = "";
    try {
      const data = await fetchAdminAuthLinks(owner.token);
      if (!isCurrent(owner, parent)) return;
      authLinks.value = data.items;
    } catch (error) {
      if (!isCurrent(owner, parent) || handleCurrentAuthError(error, owner, parent)) return;
      authLinksError.value = extractErrorMessage(error, ADMIN_AUTH_LINK_LOAD_ERROR);
    } finally {
      if (
        authLinksLoadingLease === loadingLease &&
        isCurrent(loadingLease.requestOwner, loadingLease.parentOuter)
      ) {
        releaseAuthLinksLoadingLease(loadingLease);
      }
    }
  }

  async function loadAuthLinks() {
    await loadAuthLinksOwned();
  }

  async function createAuthLink(payload: AuthLinkCreatePayload) {
    const owner = beginOperation("createAuthLink");
    if (!owner) return null;
    const inheritedLoadingLease = captureSupersededNestedLoadingLease(authLinksLoadingLease, owner);
    clearMessages();
    authLinkCreating.value = true;
    authLinkCreateError.value = "";
    try {
      const link = await createAdminAuthLink(owner.token, payload);
      if (!isCurrent(owner)) return null;
      await loadAuthLinksOwned(owner);
      if (!isCurrent(owner)) return null;
      actionMessage.value = "邀请链接已创建。";
      return link;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return null;
      releaseAuthLinksLoadingLease(inheritedLoadingLease);
      authLinkCreateError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return null;
    } finally {
      if (isCurrent(owner)) authLinkCreating.value = false;
    }
  }

  async function revokeAuthLink(linkToken: string) {
    const owner = beginOperation("revokeAuthLink");
    if (!owner) return false;
    const inheritedLoadingLease = captureSupersededNestedLoadingLease(authLinksLoadingLease, owner);
    clearMessages();
    try {
      await revokeAdminAuthLink(owner.token, linkToken);
      if (!isCurrent(owner)) return false;
      await loadAuthLinksOwned(owner);
      if (!isCurrent(owner)) return false;
      actionMessage.value = "邀请链接已撤销。";
      return true;
    } catch (error) {
      if (!isCurrent(owner) || handleCurrentAuthError(error, owner)) return false;
      releaseAuthLinksLoadingLease(inheritedLoadingLease);
      actionError.value = extractErrorMessage(error, ADMIN_ACTION_FAIL);
      return false;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    lifecycle += 1;
    retireOperationOwners();
    clearEphemeral();
    authorizationVersion += 1;
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
    dispose,
  };
}
