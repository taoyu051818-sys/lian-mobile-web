import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/html/**/*.test.ts", "tests/time/**/*.test.ts", "tests/shell/**/*.test.ts", "tests/publish/**/*.test.ts", "tests/ui/**/*.test.mjs"],
  },
});
