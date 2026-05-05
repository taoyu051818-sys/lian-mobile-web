import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const backendBaseUrl = (process.env.LIAN_BACKEND_BASE_URL || "http://127.0.0.1:4200").replace(/\/$/, "");
const imageProxyBaseUrl = (process.env.LIAN_IMAGE_PROXY_BASE_URL || "http://127.0.0.1:4201").replace(/\/$/, "");

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api/image-proxy": {
        target: imageProxyBaseUrl,
        changeOrigin: true,
      },
      "/api": {
        target: backendBaseUrl,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
