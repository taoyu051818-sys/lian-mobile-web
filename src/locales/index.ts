import { createI18n } from "vue-i18n";
import zhCN from "./zh-CN";
import en from "./en";
import { detectAppLocale, persistAppLocale, type AppLocale } from "./resolveLocale";

const initialLocale = detectAppLocale();

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: "en",
  messages: {
    "zh-CN": zhCN,
    en,
  },
});

export function t(key: string): string {
  return i18n.global.t(key);
}

/**
 * Switch the active locale at runtime and persist the choice. Use this from a
 * settings UI; navigator-driven detection runs once at startup.
 */
export function setAppLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  persistAppLocale(locale);
}

export type { AppLocale } from "./resolveLocale";
export { detectAppLocale, persistAppLocale, resolveAppLocale } from "./resolveLocale";
