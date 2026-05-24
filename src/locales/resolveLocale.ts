/**
 * Resolve the active UI language from a navigator-like input.
 *
 * Priority (PRD V0.1 §9.2):
 *   1. explicit user setting (localStorage)
 *   2. navigator.languages[]
 *   3. navigator.language
 *   4. fallback "en"
 *
 * Mapping:
 *   - zh-TW / zh-Hant / zh-HK / zh-MO → "zh-TW"
 *   - zh / zh-CN / zh-Hans / zh-* → "zh-CN"
 *   - everything else            → "en"
 *
 * Pure module — no side effects, safe to import in SSR/test.
 */

export type AppLocale = "zh-CN" | "zh-TW" | "en" | "ja" | "ko" | "ru";

export const SUPPORTED_LOCALES: readonly AppLocale[] = ["zh-CN", "zh-TW", "en", "ja", "ko", "ru"];
export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_STORAGE_KEY = "lian.language";

export interface LocaleResolverInput {
  /** Persisted user setting, if any. Wins over navigator. */
  storedLocale?: string | null;
  /** Equivalent of `navigator.languages` (ordered preference list). */
  navigatorLanguages?: readonly string[];
  /** Equivalent of `navigator.language` (single value). */
  navigatorLanguage?: string;
}

function matchLocale(tag: string | undefined | null): AppLocale | null {
  if (!tag) return null;
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return null;
  // Check for Traditional Chinese variants first (more specific)
  if (
    normalized === "zh-tw" ||
    normalized === "zh_tw" ||
    normalized === "zh-hant" ||
    normalized === "zh_hant" ||
    normalized === "zh-hk" ||
    normalized === "zh_hk" ||
    normalized === "zh-mo" ||
    normalized === "zh_mo"
  ) {
    return "zh-TW";
  }
  // Then check for Simplified Chinese / generic Chinese
  if (normalized === "zh" || normalized.startsWith("zh-") || normalized.startsWith("zh_")) {
    return "zh-CN";
  }
  if (normalized === "en" || normalized.startsWith("en-") || normalized.startsWith("en_")) {
    return "en";
  }
  if (normalized === "ja" || normalized.startsWith("ja-") || normalized.startsWith("ja_")) {
    return "ja";
  }
  if (normalized === "ko" || normalized.startsWith("ko-") || normalized.startsWith("ko_")) {
    return "ko";
  }
  if (normalized === "ru" || normalized.startsWith("ru-") || normalized.startsWith("ru_")) {
    return "ru";
  }
  return null;
}

export function resolveAppLocale(input: LocaleResolverInput = {}): AppLocale {
  const stored = matchLocale(input.storedLocale);
  if (stored) return stored;
  if (Array.isArray(input.navigatorLanguages)) {
    for (const tag of input.navigatorLanguages) {
      const matched = matchLocale(tag);
      if (matched) return matched;
    }
  }
  const single = matchLocale(input.navigatorLanguage);
  if (single) return single;
  return DEFAULT_LOCALE;
}

/**
 * Read the locale from the live browser environment. Safe in SSR — returns
 * DEFAULT_LOCALE if `window`/`navigator`/`localStorage` are unavailable.
 */
export function detectAppLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  let storedLocale: string | null = null;
  try {
    storedLocale = window.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? null;
  } catch {
    // Storage may throw under privacy modes — fall through to navigator.
  }
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  return resolveAppLocale({
    storedLocale,
    navigatorLanguages: nav?.languages ? Array.from(nav.languages) : undefined,
    navigatorLanguage: nav?.language,
  });
}

/**
 * Persist the user's explicit locale choice. No-op if storage is unavailable.
 */
export function persistAppLocale(locale: AppLocale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Privacy mode / quota errors are non-fatal here.
  }
}
