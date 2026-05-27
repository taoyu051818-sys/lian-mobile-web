import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
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
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      // alias SVGs (assets/aliases/**/*.svg) are already covered by the
      // workbox.globPatterns SVG entry below; listing them here again caused
      // every alias to land twice in the precache manifest, which made the SW
      // install reject the manifest as having duplicate URLs and left the
      // bundle stale (#230 ChannelFilterBar invisibility root cause).
      includeAssets: ["assets/pwa-icon-*.png", "assets/share-cover.png"],
      manifest: false, // Use existing public/manifest.json
      workbox: {
        // Immediate activation: take control on install without waiting
        skipWaiting: true,
        clientsClaim: true,
        // Precache only app shell files (JS, CSS, HTML, small icons)
        // Exclude large map assets (>2MB) - they use runtime CacheFirst
        globPatterns: ["**/*.{js,css,html,ico,svg,woff,woff2}"],
        globIgnores: [
          // Large map building assets - loaded on-demand
          "**/campus-*.png",
          "**/bupt-*.png",
          "**/library*.png",
          "**/life-zone-*.png",
          "**/lian-academy*.png",
          "**/*书院*.png",
        ],
        // Offline fallback: serve offline.html when navigation fails
        navigateFallback: "/offline.html",
        runtimeCaching: [
          // Do not runtime-cache API responses here. LIAN API routes are often
          // user-, session-, or resource-scoped (messages, me/profile, wallet,
          // errands, notifications, channel, admin, AI, upload, publish), and
          // optional-auth responses can vary by viewer. Only add a future API
          // rule as a narrow exact allowlist after the backend contract marks it
          // anonymous, public, and non-personalized.
          {
            // Google Fonts stylesheets: StaleWhileRevalidate
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Google Fonts webfonts: CacheFirst (immutable)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Images (local and CDN): CacheFirst with 30-day TTL
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Keep API requests out of navigation fallback handling too.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
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
