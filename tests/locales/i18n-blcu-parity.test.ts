import { describe, it, expect } from "vitest";
import zhCN from "../../src/locales/zh-CN";
import fr from "../../src/locales/fr";
import ar from "../../src/locales/ar";
import de from "../../src/locales/de";
import italian from "../../src/locales/it";
import pt from "../../src/locales/pt";
import tr from "../../src/locales/tr";
import th from "../../src/locales/th";
import mn from "../../src/locales/mn";
import kk from "../../src/locales/kk";

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

  it("de has the same key set as zh-CN", () => {
    const target = flattenKeys(de as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });

  it("it has the same key set as zh-CN", () => {
    const target = flattenKeys(italian as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });

  it("pt has the same key set as zh-CN", () => {
    const target = flattenKeys(pt as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });

  it("tr has the same key set as zh-CN", () => {
    const target = flattenKeys(tr as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });

  it("th has the same key set as zh-CN", () => {
    const target = flattenKeys(th as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });

  it("mn has the same key set as zh-CN", () => {
    const target = flattenKeys(mn as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });

  it("kk has the same key set as zh-CN", () => {
    const target = flattenKeys(kk as Record<string, unknown>);
    expect(target).toEqual(baseline);
  });
});
