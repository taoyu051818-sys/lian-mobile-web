import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("Phase 0: production source-protection baseline", () => {
  const viteConfig = readRepoFile("../../vite.config.ts");

  it("disables sourcemap in production build", () => {
    expect(viteConfig).toMatch(/sourcemap:\s*false/);
  });

  it("uses esbuild minifier and css minify", () => {
    expect(viteConfig).toMatch(/minify:\s*"esbuild"/);
    expect(viteConfig).toMatch(/cssMinify:\s*true/);
  });

  it("strips legal comments from the bundle", () => {
    expect(viteConfig).toMatch(/legalComments:\s*"none"/);
  });

  it("emits hash-only chunk/entry/asset names so source paths do not leak", () => {
    expect(viteConfig).toMatch(/chunkFileNames:\s*"assets\/\[hash\]\.js"/);
    expect(viteConfig).toMatch(/entryFileNames:\s*"assets\/\[hash\]\.js"/);
    expect(viteConfig).toMatch(/assetFileNames:\s*"assets\/\[hash\]\[extname\]"/);
  });
});

describe("Phase 0: i18n auto-switch contract", () => {
  it("locales/index.ts wires both zh-CN and en messages", () => {
    const source = readRepoFile("../../src/locales/index.ts");
    expect(source).toMatch(/import zhCN from "\.\/zh-CN"/);
    expect(source).toMatch(/import en from "\.\/en"/);
    expect(source).toMatch(/"zh-CN":\s*zhCN/);
    expect(source).toMatch(/en,?/);
  });

  it("locales/index.ts uses navigator-detected locale, not a hardcoded one", () => {
    const source = readRepoFile("../../src/locales/index.ts");
    expect(source).toMatch(/detectAppLocale\(\)/);
    expect(source).toMatch(/locale:\s*initialLocale/);
  });

  it("falls back to en (PRD V0.1 §9.2)", () => {
    const source = readRepoFile("../../src/locales/index.ts");
    expect(source).toMatch(/fallbackLocale:\s*"en"/);
  });

  it("setAppLocale persists choice to storage", () => {
    const source = readRepoFile("../../src/locales/index.ts");
    expect(source).toMatch(/export function setAppLocale/);
    expect(source).toMatch(/persistAppLocale\(locale\)/);
  });

  it("resolveLocale module exists and exports the resolver helpers", () => {
    const path = fileURLToPath(new URL("../../src/locales/resolveLocale.ts", import.meta.url));
    expect(existsSync(path)).toBe(true);
    const source = readRepoFile("../../src/locales/resolveLocale.ts");
    expect(source).toMatch(/export function resolveAppLocale/);
    expect(source).toMatch(/export function detectAppLocale/);
    expect(source).toMatch(/export const SUPPORTED_LOCALES/);
  });
});

describe("Phase 0: Audience type contract (PRD V0.1 §6.2)", () => {
  const audienceSource = readRepoFile("../../src/types/audience.ts");

  it("declares Audience interface with all five visibility-axis fields", () => {
    expect(audienceSource).toMatch(/export interface Audience/);
    expect(audienceSource).toMatch(/visibility:\s*AudienceVisibility/);
    expect(audienceSource).toMatch(/schoolIds:\s*string\[\]/);
    expect(audienceSource).toMatch(/orgIds:\s*string\[\]/);
    expect(audienceSource).toMatch(/roleIds:\s*string\[\]/);
    expect(audienceSource).toMatch(/userIds:\s*string\[\]/);
    expect(audienceSource).toMatch(/linkOnly:\s*boolean/);
  });

  it("ships a normalizer and a default audience", () => {
    expect(audienceSource).toMatch(/export function normalizeAudience/);
    expect(audienceSource).toMatch(/export const DEFAULT_AUDIENCE/);
  });

  it("declares AudienceOption with disabledReason for ungranted visibilities", () => {
    expect(audienceSource).toMatch(/export interface AudienceOption/);
    expect(audienceSource).toMatch(/disabledReason\?:\s*string/);
  });
});

describe("Phase 0: Audience options consumption layer", () => {
  it("api/audience.ts exposes fetchAudienceOptions with safe fallback on 404", () => {
    const source = readRepoFile("../../src/api/audience.ts");
    expect(source).toMatch(/export async function fetchAudienceOptions/);
    expect(source).toMatch(/\/api\/audience\/options/);
    // 404 = backend route not deployed yet — must not throw
    expect(source).toMatch(/error\.status === 404/);
  });

  it("composables/useAudienceOptions.ts loads on mount and degrades safely", () => {
    const source = readRepoFile("../../src/composables/useAudienceOptions.ts");
    expect(source).toMatch(/export function useAudienceOptions/);
    expect(source).toMatch(/onMounted/);
    expect(source).toMatch(/isAllowed/);
    expect(source).toMatch(/disabledReason/);
  });

  it("publish payload optionally carries Audience without breaking older backends", () => {
    const source = readRepoFile("../../src/types/publish.ts");
    expect(source).toMatch(/audience\?:\s*Audience/);
  });
});
