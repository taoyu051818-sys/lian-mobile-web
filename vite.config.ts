import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api/image-proxy": {
        target: "http://127.0.0.1:4201",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:4200",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
