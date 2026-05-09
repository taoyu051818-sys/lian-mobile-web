import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

function parseEnvUrl(raw: string | undefined, label: string): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (value && !/^https?:\/\/./i.test(value)) {
    throw new Error(`[vite.config] ${label} must be an absolute URL (got: ${JSON.stringify(value)})`);
  }
  return value;
}

const backendBaseUrl = parseEnvUrl(process.env.LIAN_BACKEND_BASE_URL, "LIAN_BACKEND_BASE_URL")
  || "http://127.0.0.1:4200";
const imageProxyBaseUrl = parseEnvUrl(process.env.LIAN_IMAGE_PROXY_BASE_URL, "LIAN_IMAGE_PROXY_BASE_URL")
  || "http://127.0.0.1:4201";

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
