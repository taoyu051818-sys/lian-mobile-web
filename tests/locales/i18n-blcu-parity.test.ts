import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SUPPORTED_LOCALES, RTL_LOCALES } from "../../src/locales/resolveLocale";
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

function readReadme(): string {
  return readFileSync(new URL("../../README.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function readCoverageNote(): string {
  return readFileSync(
    new URL("../../docs/architecture/blcu-locale-coverage.md", import.meta.url),
    "utf8",
  ).replace(/\r\n/g, "\n");
}

function expectReadmeList(readme: string, title: string, locales: readonly string[]): void {
  expect(readme).toContain(`${title}: ${locales.join(", ")}`);
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

describe("README i18n coverage note", () => {
  it("records shipped BLCU wave coverage and RTL scope", () => {
    const readme = readReadme();

    expectReadmeList(readme, "Shipped locales", SUPPORTED_LOCALES);
    expectReadmeList(readme, "Pre-BLCU baseline", ["zh-CN", "zh-TW", "en", "ja"]);
    expectReadmeList(readme, "BLCU wave 1", ["ko", "ru", "vi", "id", "es", "fr", "ar"]);
    expectReadmeList(readme, "BLCU wave 2", ["de", "it", "pt", "tr", "th", "mn", "kk"]);
    expectReadmeList(readme, "RTL locales", RTL_LOCALES);
    expect(readme).toMatch(
      /RTL scope is\s+limited to setting `<html lang>` and `<html dir>` from the active locale; only\s+Arabic \(`ar`\) ships with `dir="rtl"` today\./,
    );
  });
});

describe("BLCU locale coverage architecture note", () => {
  it("records shipped BLCU wave coverage and RTL scope", () => {
    const note = readCoverageNote();

    expectReadmeList(note, "Shipped locales", SUPPORTED_LOCALES);
    expectReadmeList(note, "Pre-BLCU baseline", ["zh-CN", "zh-TW", "en", "ja"]);
    expectReadmeList(note, "BLCU wave 1", ["ko", "ru", "vi", "id", "es", "fr", "ar"]);
    expectReadmeList(note, "BLCU wave 2", ["de", "it", "pt", "tr", "th", "mn", "kk"]);
    expectReadmeList(note, "RTL locales", RTL_LOCALES);
    expect(note).toContain("PR #955");
    expect(note).toContain("PR #961");
    expect(note).toMatch(
      /RTL scope is\s+limited to setting `<html lang>` and `<html dir>` from the active locale; only\s+Arabic \(`ar`\) ships with `dir="rtl"` today\./,
    );
  });
});
