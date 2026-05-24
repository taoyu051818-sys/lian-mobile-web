import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // SSR contract tests in `tests/ssr/**` import the production `entry-server`,
  // which transitively imports `App.vue`. Without the Vue plugin vitest can't
  // transform .vue SFCs and the suite fails before any assertion runs.
  plugins: [vue()],
  test: {
    include: [
      "tests/admin/**/*.test.ts",
      "tests/api/**/*.test.ts",
      "tests/auth/**/*.test.ts",
      "tests/composables/**/*.test.ts",
      "tests/config/**/*.test.ts",
      "tests/detail/**/*.test.ts",
      "tests/domain/**/*.test.ts",
      "tests/event/**/*.test.ts",
      "tests/feed/feedReadHistoryIdNormalization.contract.test.ts",
      "tests/html/**/*.test.ts",
      "tests/locales/**/*.test.ts",
      "tests/map/**/*.test.ts",
      "tests/messages/**/*.test.ts",
      "tests/time/**/*.test.ts",
      "tests/shell/**/*.test.ts",
      "tests/publish/**/*.test.ts",
      "tests/profile/**/*.test.ts",
      "tests/merchant/**/*.test.ts",
      "src/utils/__tests__/**/*.test.ts",
      "tests/motion/**/*.test.ts",
      "tests/phase0/**/*.test.ts",
      "tests/detail-navigation/**/*.test.ts",
      "tests/runner/**/*.test.ts",
      "tests/errand/**/*.test.ts",
      "tests/scripts/**/*.test.ts",
      "tests/structure/**/*.test.ts",
      "tests/ui/**/*.test.ts",
      "tests/ssr/**/*.test.ts",
    ],
  },
});
