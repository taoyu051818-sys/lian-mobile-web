import { createApp as createVueApp, type App as VueApp } from "vue";
import App from "./App.vue";
import { i18n } from "./locales";
import "./styles/main.css";

/**
 * Build a fresh Vue app + i18n instance pair.
 *
 * Phase 1.1a of the SSR/PWA RFC (`docs/architecture/SSR_PWA_RFC_2026_05_23.md`)
 * splits the entry into client / server halves so a future SSR build can
 * `import { createApp } from "./app"` without dragging client-only side effects
 * (mount, idle-time chunk prefetch, etc.) into the Node render path.
 *
 * This factory deliberately does NOT mount the app and does NOT trigger any
 * map prefetching — those are entry-client concerns.
 */
export function createApp(): { app: VueApp; i18n: typeof i18n } {
  const app = createVueApp(App);
  app.use(i18n);
  return { app, i18n };
}
