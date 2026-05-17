import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

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
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
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
    emptyOutDir: true,
    // Source protection baseline (PRD V0.1 §8.1):
    // - sourcemap disabled in production so original TypeScript/Vue source is
    //   not shipped alongside the bundle
    // - esbuild minify strips identifier names where safe; legal comments
    //   removed so internal license/headers do not leak
    sourcemap: false,
    minify: "esbuild",
    cssMinify: true,
    target: "es2020",
    rollupOptions: {
      output: {
        // Stable, content-hashed names; no path metadata in chunk names
        chunkFileNames: "assets/[hash].js",
        entryFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash][extname]",
      },
    },
  },
  esbuild: {
    legalComments: "none",
    // drop console/debugger only in production builds; dev keeps them
    drop: process.env.NODE_ENV === "production" ? ["debugger"] : [],
  },
});
