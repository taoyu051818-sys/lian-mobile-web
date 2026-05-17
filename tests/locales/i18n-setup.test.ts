import { describe, it, expect } from "vitest";
import { i18n, t } from "../../src/locales";
import zhCN from "../../src/locales/zh-CN";
import en from "../../src/locales/en";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("i18n setup", () => {
  it("initializes with a supported locale (auto-detected from navigator)", () => {
    expect(["zh-CN", "en"]).toContain(i18n.global.locale.value);
  });

  it("zh-CN messages resolve through i18n.global.t with explicit locale", () => {
    const opts = { locale: "zh-CN" } as const;
    expect(i18n.global.t("app.name", {}, opts)).toBe("黎安屿你");
    expect(i18n.global.t("user.defaultLabel", {}, opts)).toBe("同学");
    expect(i18n.global.t("loading.feed", {}, opts)).toBe("正在加载校园内容…");
    expect(i18n.global.t("error.loadGeneric", {}, opts)).toBe("暂时没加载出来，可以稍后再试。");
    expect(i18n.global.t("content.untitled", {}, opts)).toBe("未命名内容");
  });

  it("en messages resolve through i18n.global.t with explicit locale", () => {
    const opts = { locale: "en" } as const;
    expect(i18n.global.t("app.name", {}, opts)).toBe("Lian");
    expect(i18n.global.t("user.defaultLabel", {}, opts)).toBe("friend");
    expect(i18n.global.t("loading.feed", {}, opts)).toBe("Loading campus content…");
  });

  it("t() resolves through the active locale", () => {
    const result = t("app.name");
    // t() reflects whatever locale auto-detect picked at import time;
    // both translations are valid outcomes.
    expect([zhCN.app.name, en.app.name]).toContain(result);
  });

  it("all zh-CN keys are resolvable", () => {
    const keys = flattenKeys(zhCN as Record<string, unknown>);
    for (const key of keys) {
      const resolved = i18n.global.t(key, {}, { locale: "zh-CN" });
      expect(resolved).toBeTruthy();
      expect(typeof resolved).toBe("string");
    }
  });

  it("all en keys are resolvable", () => {
    const keys = flattenKeys(en as Record<string, unknown>);
    for (const key of keys) {
      const resolved = i18n.global.t(key, {}, { locale: "en" });
      expect(resolved).toBeTruthy();
      expect(typeof resolved).toBe("string");
    }
  });

  it("t() returns key for unknown keys (fallback behavior)", () => {
    const result = t("nonexistent.key");
    expect(result).toBe("nonexistent.key");
  });
});
