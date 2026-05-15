import { createI18n } from "vue-i18n";
import zhCN from "./zh-CN";

export const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  messages: { "zh-CN": zhCN },
});

export function t(key: string): string {
  return i18n.global.t(key);
}
