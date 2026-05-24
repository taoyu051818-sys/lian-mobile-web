import { describe, it, expect } from "vitest";
import zhCN from "../../src/locales/zh-CN";
import fr from "../../src/locales/fr";
import ar from "../../src/locales/ar";

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
  return keys.sort();
}

describe("BLCU locale parity vs zh-CN", () => {
  const baseline = flattenKeys(zhCN as Record<string, unknown>);

  it("fr has the same key set as zh-CN", () => {
    const target = flattenKeys(fr as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });

  it("ar has the same key set as zh-CN", () => {
    const target = flattenKeys(ar as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });
});
