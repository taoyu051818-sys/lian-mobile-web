import { createApp } from "./app";
import { installDisableGestureZoom } from "./composables/useDisableGestureZoom";
import { registerSW } from "virtual:pwa-register";

installDisableGestureZoom();
const { app } = createApp();
app.mount("#vue-root");

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
