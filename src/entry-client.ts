import { createApp } from "./app";
import { installDisableGestureZoom } from "./composables/useDisableGestureZoom";
import { startOfflineFixtureRuntime } from "./platform/ui-fixtures";
import { registerSW } from "virtual:pwa-register";

installDisableGestureZoom();

/**
 * Mount the SPA. In offline fixture mode the transport must be installed BEFORE
 * mounting, otherwise the first views fire their reads against the real
 * network and only later requests get intercepted.
 *
 * `startOfflineFixtureRuntime()` resolves immediately (returns `false`) in
 * production and whenever `VITE_UI_FIXTURES` is not `"true"`, so the normal
 * path just pays one already-resolved promise tick.
 */
async function bootstrap(): Promise<void> {
  await startOfflineFixtureRuntime();
  const { app } = createApp();
  app.mount("#vue-root");
}

void bootstrap();

// PWA service worker registration with update prompt
// RFC §8: "New SW detected → SPA shows a non-blocking toast"
const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch custom event for the app to show update toast
    window.dispatchEvent(
      new CustomEvent("pwa-update-available", {
        detail: { updateSW },
      }),
    );
  },
  onOfflineReady() {
    // App is ready for offline use - no action needed
  },
  onRegisteredSW(_swUrl, registration) {
    // Check for updates periodically (every hour)
    if (registration) {
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000,
      );
    }
  },
});

// Side-effect: keep the existing idle-time prefetch of the map view chunk so a
// tap on the map tab doesn't pay first-load cost. This is client-only and
// must never reach the SSR entry, which is why it lives here rather than in
// `./app`.
function prefetchMapChunk(): void {
  import("./features/map/MapLeafletView.vue").catch(() => {});
}

if (typeof requestIdleCallback === "function") {
  requestIdleCallback(prefetchMapChunk, { timeout: 3000 });
} else {
  setTimeout(prefetchMapChunk, 2000);
}
