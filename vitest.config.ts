import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/api/**/*.test.ts",
      "tests/auth/**/*.test.ts",
      "tests/composables/**/*.test.ts",
      "tests/config/**/*.test.ts",
      "tests/detail/**/*.test.ts",
      "tests/feed/feedReadHistoryIdNormalization.contract.test.ts",
      "tests/html/**/*.test.ts",
      "tests/locales/**/*.test.ts",
      "tests/map/**/*.test.ts",
      "tests/time/**/*.test.ts",
      "tests/shell/**/*.test.ts",
      "tests/publish/**/*.test.ts",
      "tests/profile/**/*.test.ts",
      "src/utils/__tests__/**/*.test.ts",
      "tests/motion/**/*.test.ts",
      "tests/phase0/**/*.test.ts",
      "tests/detail-navigation/**/*.test.ts",
      "tests/runner/**/*.test.ts",
    ],
  },
});
