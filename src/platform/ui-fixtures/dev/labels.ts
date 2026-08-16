/**
 * Chinese labels for the DEV fixture toolbar controls.
 *
 * Split out of `FixtureToolbar.vue` to keep that component under the repo's
 * size threshold. Each map is typed as a total `Record` over its union, so
 * adding a scenario/identity/volume without a label fails typecheck rather
 * than silently rendering a raw enum key.
 */

import type { FixtureIdentity, FixtureScenario, FixtureVolume } from "../types";

export const SCENARIO_LABELS: Record<FixtureScenario, string> = {
  normal: "正常",
  empty: "空数据",
  "partial-data": "缺可选字段",
  "long-copy": "超长文案",
  "many-items": "大量条目",
  loading: "加载中",
  error: "请求失败",
  "not-found": "404",
  forbidden: "无权限",
  unauthorized: "未登录",
  timeout: "请求超时",
  "rate-limited": "限流",
};

export const IDENTITY_LABELS: Record<FixtureIdentity, string> = {
  guest: "游客",
  registered: "已注册（未认证）",
  "verified-student": "在校学生",
  "merchant-pending": "商家（待审核）",
  "merchant-approved": "商家（已通过）",
  runner: "骑手",
  "organization-member": "社团成员",
  admin: "管理员",
  "disabled-user": "已封禁",
};

export const VOLUME_LABELS: Record<FixtureVolume, string> = {
  sparse: "少",
  default: "中",
  dense: "多",
};
