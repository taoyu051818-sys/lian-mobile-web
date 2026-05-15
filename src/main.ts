import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./locales";
import "./styles/main.css";

const app = createApp(App);
app.use(i18n);
app.mount("#vue-root");

function prefetchMapChunk() {
  import("./views/MapLeafletView.vue").catch(() => {});
}

if (typeof requestIdleCallback === "function") {
  requestIdleCallback(prefetchMapChunk, { timeout: 3000 });
} else {
  setTimeout(prefetchMapChunk, 2000);
}
