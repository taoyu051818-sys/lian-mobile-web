/**
 * Deterministic corpus + scenario shaping helpers shared by every fixture
 * handler.
 *
 * Determinism matters: the same scenario + identity + volume must always
 * produce byte-identical data so a visual regression is a real regression and
 * not fixture noise. There is no Math.random() anywhere in this subtree — all
 * variation comes from a seeded index.
 *
 * Asset policy: no remote URLs, no Unsplash, no CDN, no avatar services. Covers
 * are local SVG data URIs / CSS-gradient placeholders generated below, and the
 * commerce contract's `logoAssetRef` / `coverAssetRef` stay `null` exactly as
 * src/types/commerce.ts declares them.
 */

import type { FixtureIdentity, FixtureScenario, FixtureVolume } from "../types";

const AREAS = [
  "北苑食堂",
  "图书馆西门",
  "三号教学楼",
  "南门快递站",
  "体育馆",
  "留学生公寓",
  "逸夫楼",
  "东区篮球场",
] as const;

const DISPLAY_NAMES = [
  "沈知也",
  "林一舟",
  "周与安",
  "苏见明",
  "陈斯年",
  "何以樵",
  "钟未晚",
  "许南亭",
] as const;

const POST_TITLES = [
  "北苑三楼今晚有免费汤",
  "图书馆西门丢了一把黑色雨伞",
  "周六下午羽毛球缺两个人",
  "转让一台九成新台灯",
  "留学生公寓热水器维修进度",
  "三教 302 自习室今天开放到十点",
  "校园马拉松志愿者报名",
  "南门快递站排队情况实时更新",
] as const;

const BODY_PREVIEWS = [
  "刚路过看到还剩不少，动作快的话应该还能赶上。",
  "深色伞面木质伞柄，捡到的同学可以联系我。",
  "场地已经订好，缺两个人凑满双打，水平随意。",
  "用了一个学期，功能完好，可以到宿舍楼下自取。",
  "维修师傅说今天下午三点前会处理完，先别急着投诉。",
] as const;

const LONG_TITLE =
  "关于本周末校园马拉松志愿者招募以及物资分发点位调整的详细说明请所有已报名同学务必完整阅读避免遗漏关键信息";

const LONG_BODY =
  "本次活动的志愿者集合时间调整为周六上午六点四十分，集合地点由原定的体育馆正门改为体育馆东侧器材室门口，" +
  "请所有同学提前十五分钟到场签到并领取反光背心与对讲机。物资分发点位共设置六个，分别位于起点、三公里处、" +
  "六公里处、九公里处、终点以及医疗保障区，每个点位配备两名志愿者与一名机动人员。若因天气原因需要调整赛道，" +
  "现场指挥会通过对讲机统一通知，请不要擅自离开点位。活动结束后统一在体育馆一号会议室归还物资并登记志愿时长。";

function seeded<T>(pool: readonly T[], index: number): T {
  return pool[index % pool.length] as T;
}

/** Local, dependency-free cover placeholder. Never a remote URL. */
export function localCover(index: number): string {
  const hue = (index * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 46% 82%)"/><stop offset="1" stop-color="hsl(${(hue + 38) % 360} 40% 66%)"/></linearGradient></defs><rect width="96" height="64" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function area(index: number): string {
  return seeded(AREAS, index);
}

export function displayName(index: number): string {
  return seeded(DISPLAY_NAMES, index);
}

export function postTitle(index: number, scenario: FixtureScenario): string {
  return scenario === "long-copy" ? LONG_TITLE : seeded(POST_TITLES, index);
}

export function bodyPreview(index: number, scenario: FixtureScenario): string {
  return scenario === "long-copy" ? LONG_BODY : seeded(BODY_PREVIEWS, index);
}

/** Big but plausible numbers so number formatting/truncation gets exercised. */
export function countFor(index: number, scenario: FixtureScenario): number {
  if (scenario === "long-copy" || scenario === "many-items") return 128_640 + index * 977;
  return (index * 37) % 420;
}

/** How many list rows a scenario+volume combination should produce. */
export function itemCount(scenario: FixtureScenario, volume: FixtureVolume): number {
  if (scenario === "empty") return 0;
  if (scenario === "many-items") return volume === "sparse" ? 40 : volume === "dense" ? 120 : 80;
  if (scenario === "long-copy") return 3;
  if (scenario === "partial-data") return 4;
  switch (volume) {
    case "sparse":
      return 2;
    case "dense":
      return 24;
    default:
      return 8;
  }
}

/**
 * `partial-data` drops optional fields so the UI's "missing summary / no
 * rating / no cover" branches are actually reachable.
 */
export function isPartial(scenario: FixtureScenario, index: number): boolean {
  return scenario === "partial-data" && index % 2 === 0;
}

export function timestampFor(index: number): string {
  // Fixed epoch so snapshots stay stable across runs.
  const base = Date.UTC(2026, 2, 14, 1, 30, 0);
  return new Date(base - index * 37 * 60_000).toISOString();
}

export function timeLabelFor(index: number): string {
  if (index === 0) return "刚刚";
  if (index < 4) return `${index * 7} 分钟前`;
  if (index < 12) return `${index} 小时前`;
  return `${Math.floor(index / 7)} 天前`;
}

export interface IdentityProfile {
  id: string;
  username: string;
  authenticated: boolean;
  identityTags: string[];
  verificationTags: string[];
  roles: string[];
  disabled: boolean;
}

const IDENTITY_PROFILES: Record<FixtureIdentity, IdentityProfile> = {
  guest: {
    id: "",
    username: "",
    authenticated: false,
    identityTags: [],
    verificationTags: [],
    roles: [],
    disabled: false,
  },
  registered: {
    id: "u-registered",
    username: "新同学",
    authenticated: true,
    identityTags: [],
    verificationTags: [],
    roles: ["user"],
    disabled: false,
  },
  "verified-student": {
    id: "u-verified-student",
    username: "沈知也",
    authenticated: true,
    identityTags: ["在校生"],
    verificationTags: ["campus-email"],
    roles: ["user"],
    disabled: false,
  },
  "merchant-pending": {
    id: "u-merchant-pending",
    username: "北苑小食待审",
    authenticated: true,
    identityTags: ["商户"],
    verificationTags: ["campus-email"],
    roles: ["user", "merchant"],
    disabled: false,
  },
  "merchant-approved": {
    id: "u-merchant-approved",
    username: "北苑小食",
    authenticated: true,
    identityTags: ["商户", "已认证"],
    verificationTags: ["campus-email", "merchant"],
    roles: ["user", "merchant"],
    disabled: false,
  },
  runner: {
    id: "u-runner",
    username: "林一舟",
    authenticated: true,
    identityTags: ["在校生", "跑腿"],
    verificationTags: ["campus-email", "realname"],
    roles: ["user", "runner"],
    disabled: false,
  },
  "organization-member": {
    id: "u-org-member",
    username: "学生会宣传部",
    authenticated: true,
    identityTags: ["组织成员"],
    verificationTags: ["campus-email", "organization"],
    roles: ["user", "organization"],
    disabled: false,
  },
  admin: {
    id: "u-admin",
    username: "平台管理员",
    authenticated: true,
    identityTags: ["管理员"],
    verificationTags: ["campus-email", "realname"],
    roles: ["user", "admin"],
    disabled: false,
  },
  "disabled-user": {
    id: "u-disabled",
    username: "已封禁账号",
    authenticated: true,
    identityTags: [],
    verificationTags: [],
    roles: ["user"],
    disabled: true,
  },
};

export function identityProfile(identity: FixtureIdentity): IdentityProfile {
  return IDENTITY_PROFILES[identity];
}

export function isAdmin(identity: FixtureIdentity): boolean {
  return identity === "admin";
}

export function isMerchant(identity: FixtureIdentity): boolean {
  return identity === "merchant-approved" || identity === "merchant-pending";
}

export function isRunner(identity: FixtureIdentity): boolean {
  return identity === "runner";
}

/** Builds a deterministic list of `itemCount` rows. */
export function buildList<T>(
  scenario: FixtureScenario,
  volume: FixtureVolume,
  factory: (index: number) => T,
): T[] {
  const total = itemCount(scenario, volume);
  return Array.from({ length: total }, (_unused, index) => factory(index));
}
