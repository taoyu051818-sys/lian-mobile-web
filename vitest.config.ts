import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/html/**/*.test.ts", "tests/time/**/*.test.ts", "tests/shell/**/*.test.ts", "tests/publish/**/*.test.ts", "tests/profile/**/*.test.ts", "tests/motion/**/*.test.ts", "tests/feed/**/*.test.mjs"],
  },
});
