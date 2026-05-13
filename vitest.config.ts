import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/auth/**/*.test.ts",
      "tests/composables/**/*.test.ts",
      "tests/detail/**/*.test.ts",
      "tests/feed/feedPresentationIntent.structure.test.mjs",
      "tests/feed/feedReadHistoryIdNormalization.contract.test.ts",
      "tests/html/**/*.test.ts",
      "tests/time/**/*.test.ts",
      "tests/shell/**/*.test.ts",
      "tests/publish/**/*.test.ts",
      "tests/profile/**/*.test.ts",
      "tests/motion/**/*.test.ts",
    ],
  },
});
