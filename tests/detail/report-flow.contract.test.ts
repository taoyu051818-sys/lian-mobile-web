import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LianApiError } from "../../src/api/http";
import {
  buildReportPayload,
  getReportReasonPlaceholder,
  getReportSubmissionMessage,
  shouldShowReportReasonField,
} from "../../src/features/detail/reportFlow";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("report flow helper", () => {
  it("only enables optional free-text context for privacy, abuse, and other", () => {
    expect(shouldShowReportReasonField("privacy")).toBe(true);
    expect(shouldShowReportReasonField("abuse")).toBe(true);
    expect(shouldShowReportReasonField("other")).toBe(true);
    expect(shouldShowReportReasonField("false_info")).toBe(false);
    expect(shouldShowReportReasonField("wrong_location")).toBe(false);
  });

  it("provides category-specific placeholders for optional report detail", () => {
    expect(getReportReasonPlaceholder("privacy")).toContain("隐私");
    expect(getReportReasonPlaceholder("abuse")).toContain("骚扰");
    expect(getReportReasonPlaceholder("other")).toContain("补充说明");
    expect(getReportReasonPlaceholder("expired")).toBe("");
  });

  it("builds a backend-compatible report payload while preserving optional context", () => {
    expect(buildReportPayload("privacy", "  暴露了宿舍位置  ")).toEqual({
      category: "privacy",
      reason: "隐私问题：暴露了宿舍位置",
    });

    expect(buildReportPayload("expired", "")).toEqual({
      category: "expired",
      reason: "过期内容",
    });

    expect(buildReportPayload("expired", "旧说明不该带上")).toEqual({
      category: "expired",
      reason: "过期内容",
    });
  });

  it("maps duplicate, rate-limit, and auth failures to stable user-facing copy", () => {
    expect(
      getReportSubmissionMessage(new LianApiError("already reported", 409, "duplicate_report")),
    ).toContain("已经提交过举报");
    expect(
      getReportSubmissionMessage(new LianApiError("too many requests", 429, "rate_limit")),
    ).toContain("太频繁");
    expect(
      getReportSubmissionMessage(new LianApiError("unauthorized", 401, "auth_required")),
    ).toContain("先登录");
    expect(getReportSubmissionMessage(new Error("boom"))).toContain("没有提交成功");
  });
});

describe("report flow detail wiring", () => {
  const panelSource = readRepoFile("../../src/features/detail/PostDetailPanel.vue");
  const reportComposableSource = readRepoFile("../../src/features/detail/usePostReport.ts");
  const reportBlockSource = readRepoFile("../../src/features/detail/PostReportBlock.vue");
  const hiddenStateSource = readRepoFile("../../src/features/detail/PostDetailHiddenState.vue");

  it("keeps report helper logic in a dedicated detail helper module", () => {
    expect(reportComposableSource).toContain('from "./reportFlow"');
    expect(reportComposableSource).toContain(
      "buildReportPayload(reportCategory.value, reportReason.value)",
    );
    expect(reportComposableSource).toContain("getReportSubmissionMessage(error)");
  });

  it("wires report composable through PostDetailPanel", () => {
    expect(panelSource).toContain('from "./usePostReport"');
    expect(panelSource).toContain("usePostReport(");
  });

  it("adds optional free-text context and a reversible local hide path", () => {
    expect(reportBlockSource).toContain("REPORT_REASON_NOTE");
    expect(reportBlockSource).toContain("<textarea");
    expect(reportBlockSource).toContain("REPORT_HIDE_LABEL");
    expect(hiddenStateSource).toContain("HIDDEN_STATE_TITLE");
    expect(hiddenStateSource).toContain("HIDDEN_STATE_UNDO");
  });
});
