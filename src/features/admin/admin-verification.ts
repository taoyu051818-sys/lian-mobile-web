import {
  ADMIN_VERIFICATION_EMPTY_ALL_BODY,
  ADMIN_VERIFICATION_EMPTY_ALL_TITLE,
  ADMIN_VERIFICATION_EMPTY_APPROVED_BODY,
  ADMIN_VERIFICATION_EMPTY_APPROVED_TITLE,
  ADMIN_VERIFICATION_EMPTY_PENDING_BODY,
  ADMIN_VERIFICATION_EMPTY_PENDING_TITLE,
  ADMIN_VERIFICATION_EMPTY_REJECTED_BODY,
  ADMIN_VERIFICATION_EMPTY_REJECTED_TITLE,
  ADMIN_VERIFICATION_STATUS_ALL,
  ADMIN_VERIFICATION_STATUS_APPROVED,
  ADMIN_VERIFICATION_STATUS_PENDING,
  ADMIN_VERIFICATION_STATUS_REJECTED,
  ADMIN_VERIFICATION_SUMMARY_CONTACT,
  ADMIN_VERIFICATION_SUMMARY_ID_NUMBER,
  ADMIN_VERIFICATION_SUMMARY_ID_TYPE,
  ADMIN_VERIFICATION_SUMMARY_MERCHANT_NAME,
  ADMIN_VERIFICATION_SUMMARY_NOTE,
  ADMIN_VERIFICATION_SUMMARY_ORG_ID,
  ADMIN_VERIFICATION_SUMMARY_ORG_NAME,
  ADMIN_VERIFICATION_SUMMARY_REAL_NAME,
  ADMIN_VERIFICATION_TYPE_MERCHANT,
  ADMIN_VERIFICATION_TYPE_ORG_JOIN,
  ADMIN_VERIFICATION_TYPE_REALNAME,
  ADMIN_VERIFICATION_TYPE_RUNNER,
} from "../../config/brand";
import type {
  AdminVerificationDecisionStatus,
  AdminVerificationDetail,
  AdminVerificationRequest,
  AdminVerificationStatus,
  AdminVerificationType,
} from "../../api/admin";

export type {
  AdminVerificationDecisionStatus,
  AdminVerificationDetail,
  AdminVerificationRequest,
  AdminVerificationStatus,
  AdminVerificationType,
};

export type AdminVerificationSummaryRow = { label: string; value: string };

export const VERIFICATION_STATUS_LABELS: Record<AdminVerificationStatus | "", string> = {
  "": ADMIN_VERIFICATION_STATUS_ALL,
  pending: ADMIN_VERIFICATION_STATUS_PENDING,
  approved: ADMIN_VERIFICATION_STATUS_APPROVED,
  rejected: ADMIN_VERIFICATION_STATUS_REJECTED,
};

export const VERIFICATION_TYPE_LABELS: Record<AdminVerificationType, string> = {
  "org-join": ADMIN_VERIFICATION_TYPE_ORG_JOIN,
  realname: ADMIN_VERIFICATION_TYPE_REALNAME,
  merchant: ADMIN_VERIFICATION_TYPE_MERCHANT,
  runner: ADMIN_VERIFICATION_TYPE_RUNNER,
};

export const verificationFilters: Array<{ value: AdminVerificationStatus | ""; label: string }> = [
  { value: "", label: VERIFICATION_STATUS_LABELS[""] },
  { value: "pending", label: VERIFICATION_STATUS_LABELS.pending },
  { value: "approved", label: VERIFICATION_STATUS_LABELS.approved },
  { value: "rejected", label: VERIFICATION_STATUS_LABELS.rejected },
];

export function verificationTypeLabel(type: AdminVerificationType) {
  return VERIFICATION_TYPE_LABELS[type] || type;
}

export function verificationStatusLabel(status: AdminVerificationStatus | string) {
  return VERIFICATION_STATUS_LABELS[status as AdminVerificationStatus] || status;
}

function summaryRecord(request: AdminVerificationRequest) {
  const { publicSummary } = request;
  if (!publicSummary || typeof publicSummary !== "object" || Array.isArray(publicSummary)) {
    return {} as Record<string, unknown>;
  }
  return publicSummary as Record<string, unknown>;
}

function formatSummaryValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function verificationSummaryRows(
  request: AdminVerificationRequest,
): AdminVerificationSummaryRow[] {
  const summary = summaryRecord(request);
  if (request.verificationType === "org-join") {
    return [
      {
        label: ADMIN_VERIFICATION_SUMMARY_ORG_NAME,
        value: formatSummaryValue(summary.orgName) || formatSummaryValue(summary.orgId),
      },
      { label: ADMIN_VERIFICATION_SUMMARY_ORG_ID, value: formatSummaryValue(summary.orgId) },
      { label: ADMIN_VERIFICATION_SUMMARY_NOTE, value: formatSummaryValue(summary.note) },
    ].filter((row) => row.value);
  }
  if (request.verificationType === "realname") {
    return [
      { label: ADMIN_VERIFICATION_SUMMARY_ID_TYPE, value: formatSummaryValue(summary.idType) },
      { label: ADMIN_VERIFICATION_SUMMARY_REAL_NAME, value: formatSummaryValue(summary.realName) },
      { label: ADMIN_VERIFICATION_SUMMARY_ID_NUMBER, value: formatSummaryValue(summary.idNumber) },
      { label: ADMIN_VERIFICATION_SUMMARY_CONTACT, value: formatSummaryValue(summary.contact) },
    ].filter((row) => row.value);
  }
  if (request.verificationType === "merchant") {
    return [
      {
        label: ADMIN_VERIFICATION_SUMMARY_MERCHANT_NAME,
        value: formatSummaryValue(summary.merchantName),
      },
      { label: ADMIN_VERIFICATION_SUMMARY_NOTE, value: formatSummaryValue(summary.note) },
    ].filter((row) => row.value);
  }
  return [
    { label: ADMIN_VERIFICATION_SUMMARY_NOTE, value: formatSummaryValue(summary.note) },
  ].filter((row) => row.value);
}

export function revealedRealnameRows(
  detail: AdminVerificationDetail | undefined,
): AdminVerificationSummaryRow[] {
  if (!detail) return [];
  return [
    { label: ADMIN_VERIFICATION_SUMMARY_ID_TYPE, value: detail.idType?.trim() || "" },
    { label: ADMIN_VERIFICATION_SUMMARY_REAL_NAME, value: detail.realName?.trim() || "" },
    { label: ADMIN_VERIFICATION_SUMMARY_ID_NUMBER, value: detail.idNumber?.trim() || "" },
    { label: ADMIN_VERIFICATION_SUMMARY_CONTACT, value: detail.contact?.trim() || "" },
  ].filter((row) => row.value);
}

export function canRevealRealname(request: AdminVerificationRequest) {
  return request.verificationType === "realname";
}

export function canReviewRequest(request: AdminVerificationRequest) {
  return request.status === "pending";
}

export function getVerificationEmptyState(filter: AdminVerificationStatus | "") {
  switch (filter) {
    case "pending":
      return {
        title: ADMIN_VERIFICATION_EMPTY_PENDING_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_PENDING_BODY,
      };
    case "approved":
      return {
        title: ADMIN_VERIFICATION_EMPTY_APPROVED_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_APPROVED_BODY,
      };
    case "rejected":
      return {
        title: ADMIN_VERIFICATION_EMPTY_REJECTED_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_REJECTED_BODY,
      };
    default:
      return {
        title: ADMIN_VERIFICATION_EMPTY_ALL_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_ALL_BODY,
      };
  }
}
