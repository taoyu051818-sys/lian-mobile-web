import { describe, it, expect } from "vitest";
import { i18n, t } from "../../src/locales";
import zhCN from "../../src/locales/zh-CN";

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
  it("creates i18n instance with zh-CN locale", () => {
    expect(i18n.global.locale.value).toBe("zh-CN");
  });

  it("t() resolves known keys", () => {
    expect(t("app.name")).toBe("黎安屿你");
    expect(t("user.defaultLabel")).toBe("同学");
    expect(t("loading.feed")).toBe("正在加载校园内容…");
    expect(t("error.loadGeneric")).toBe("暂时没加载出来，可以稍后再试。");
    expect(t("content.untitled")).toBe("未命名内容");
  });

  it("all zh-CN keys are resolvable via t()", () => {
    const keys = flattenKeys(zhCN as Record<string, unknown>);
    for (const key of keys) {
      const resolved = t(key);
      expect(resolved).toBeTruthy();
      expect(typeof resolved).toBe("string");
    }
  });

  it("t() returns key for unknown keys (fallback behavior)", () => {
    const result = t("nonexistent.key");
    expect(result).toBe("nonexistent.key");
  });
});
