import { createApp } from "./app";

const { app } = createApp();
app.mount("#vue-root");

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
