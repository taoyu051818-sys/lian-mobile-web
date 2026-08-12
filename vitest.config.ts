import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // SSR contract tests in `tests/ssr/**` import the production `entry-server`,
  // which transitively imports `App.vue`. Without the Vue plugin vitest can't
  // transform .vue SFCs and the suite fails before any assertion runs.
  plugins: [vue()],
  test: {
    include: [
      "tests/**/*.test.ts",
      "src/**/*.test.ts",
    ],
  },
});
