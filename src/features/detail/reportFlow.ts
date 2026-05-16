import { LianApiError } from "../../api/http";
import type { ReportPostPayload } from "../../api/posts";
import {
  REPORT_CAT_PRIVACY,
  REPORT_CAT_FALSE_INFO,
  REPORT_CAT_ABUSE,
  REPORT_CAT_WRONG_LOCATION,
  REPORT_CAT_EXPIRED,
  REPORT_CAT_OTHER,
  REPORT_PLACEHOLDER_PRIVACY,
  REPORT_PLACEHOLDER_ABUSE,
  REPORT_PLACEHOLDER_OTHER,
  REPORT_DUPLICATE,
  REPORT_RATE_LIMIT,
  REPORT_AUTH_REQUIRED,
  REPORT_GENERIC,
} from "../../config/brand";

export interface ReportCategoryOption {
  value: string;
  label: string;
}

export const REPORT_CATEGORIES: ReportCategoryOption[] = [
  { value: "privacy", label: REPORT_CAT_PRIVACY },
  { value: "false_info", label: REPORT_CAT_FALSE_INFO },
  { value: "abuse", label: REPORT_CAT_ABUSE },
  { value: "wrong_location", label: REPORT_CAT_WRONG_LOCATION },
  { value: "expired", label: REPORT_CAT_EXPIRED },
  { value: "other", label: REPORT_CAT_OTHER },
];

const REPORT_DETAIL_ENABLED = new Set(["privacy", "abuse", "other"]);

export function getReportCategory(category: string): ReportCategoryOption {
  return REPORT_CATEGORIES.find((item) => item.value === category) || REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1];
}

export function shouldShowReportReasonField(category: string) {
  return REPORT_DETAIL_ENABLED.has(category);
}

export function getReportReasonPlaceholder(category: string) {
  switch (category) {
    case "privacy":
      return REPORT_PLACEHOLDER_PRIVACY;
    case "abuse":
      return REPORT_PLACEHOLDER_ABUSE;
    case "other":
      return REPORT_PLACEHOLDER_OTHER;
    default:
      return "";
  }
}

export function buildReportPayload(category: string, detail: string): ReportPostPayload {
  const option = getReportCategory(category);
  const normalizedDetail = shouldShowReportReasonField(category) ? String(detail || "").trim() : "";
  return {
    category: option.value,
    reason: normalizedDetail ? `${option.label}：${normalizedDetail}` : option.label,
  };
}

export function getReportSubmissionMessage(error: unknown) {
  if (error instanceof LianApiError) {
    const message = `${error.message || ""}`.toLowerCase();
    const code = `${error.code || ""}`.toLowerCase();

    if (error.status === 409 || code.includes("duplicate") || message.includes("duplicate") || message.includes("已举报")) {
      return REPORT_DUPLICATE;
    }

    if (error.status === 429 || code.includes("rate") || message.includes("too many") || message.includes("过于频繁")) {
      return REPORT_RATE_LIMIT;
    }

    if (error.status === 401 || error.status === 403) {
      return REPORT_AUTH_REQUIRED;
    }
  }

  return REPORT_GENERIC;
}
