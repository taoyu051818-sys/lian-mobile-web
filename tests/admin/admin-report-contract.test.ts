import { describe, expect, it } from "vitest";

import { adminActionLabel, adminStatusLabel } from "../../src/features/admin/admin-format";
import type { AdminReportStatus } from "../../src/types/admin";

const lifecycleStatuses: AdminReportStatus[] = ["pending", "reviewing", "resolved", "dismissed"];

const legacyOutcomeStatuses = [
  "ignored",
  "handled",
  "hidden",
  "restricted",
  "banned",
  "restored",
  "false_report",
];

describe("admin report lifecycle contract", () => {
  it("keeps report status lifecycle-only", () => {
    expect(lifecycleStatuses).toEqual(["pending", "reviewing", "resolved", "dismissed"]);
  });

  it("does not treat legacy moderation outcomes as report statuses", () => {
    for (const status of legacyOutcomeStatuses) {
      expect(lifecycleStatuses).not.toContain(status);
    }
  });

  it("labels moderation actions separately from lifecycle status", () => {
    expect(adminStatusLabel("resolved")).toBe("已处理");
    expect(adminActionLabel("hide_post")).toBe("隐藏帖子");
    expect(adminActionLabel("mark_false_report")).toBe("标记误报");
  });
});
