import { createI18n } from "vue-i18n";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";
import en from "./en";
import ja from "./ja";
import ko from "./ko";
import ru from "./ru";
import vi from "./vi";
import id from "./id";
import es from "./es";
import fr from "./fr";
import ar from "./ar";
import de from "./de";
import it from "./it";
import pt from "./pt";
import tr from "./tr";
import th from "./th";
import mn from "./mn";
import kk from "./kk";
import { detectAppLocale, isRtlLocale, persistAppLocale, type AppLocale } from "./resolveLocale";

const initialLocale = detectAppLocale();

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: "en",
  messages: {
    "zh-CN": zhCN,
    "zh-TW": zhTW,
    en,
    ja,
    ko,
    ru,
    vi,
    id,
    es,
    fr,
    ar,
    de,
    it,
    pt,
    tr,
    th,
    mn,
    kk,
  },
});

// Apply <html dir> + <html lang> on initial load so SSR-painted markup and
// the first client paint already match the resolved locale's script
// direction. The mirror happens again on every setAppLocale() call below.
function applyDocumentLocaleAttrs(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root) return;
  root.setAttribute("lang", locale);
  root.setAttribute("dir", isRtlLocale(locale) ? "rtl" : "ltr");
}

applyDocumentLocaleAttrs(initialLocale);

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
  applyDocumentLocaleAttrs(locale);
}

export type { AppLocale } from "./resolveLocale";
export { detectAppLocale, isRtlLocale, persistAppLocale, resolveAppLocale } from "./resolveLocale";
