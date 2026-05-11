import { LianApiError } from "../../api/http";
import type { ReportPostPayload } from "../../api/posts";

export interface ReportCategoryOption {
  value: string;
  label: string;
}

export const REPORT_CATEGORIES: ReportCategoryOption[] = [
  { value: "privacy", label: "隐私问题" },
  { value: "false_info", label: "虚假信息" },
  { value: "abuse", label: "违规内容" },
  { value: "wrong_location", label: "位置错误" },
  { value: "expired", label: "过期内容" },
  { value: "other", label: "其他" },
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
      return "可以补充说明泄露了哪些隐私信息，帮助平台更快处理。";
    case "abuse":
      return "可以补充说明骚扰、攻击或违规的具体情况。";
    case "other":
      return "可以补充说明你想反馈的问题。";
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
      return "这条内容已经提交过举报了，我们会继续跟进。";
    }

    if (error.status === 429 || code.includes("rate") || message.includes("too many") || message.includes("过于频繁")) {
      return "提交太频繁了，请稍后再试。";
    }

    if (error.status === 401 || error.status === 403) {
      return "需要先登录后才能举报这条内容。";
    }
  }

  return "举报没有提交成功，可以稍后再试。";
}
