import { describe, it, expect } from "vitest";
import * as brand from "../../src/config/brand";

const STRING_ENTRIES = Object.entries(brand).filter(([, value]) => typeof value === "string") as Array<
  [string, string]
>;

describe("brand constants", () => {
  it("exports at least one string constant", () => {
    expect(STRING_ENTRIES.length).toBeGreaterThan(0);
  });

  for (const [key, value] of STRING_ENTRIES) {
    it(`${key} is a non-empty string`, () => {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });

    it(`${key} has no leading or trailing whitespace`, () => {
      expect(value).toBe(value.trim());
    });
  }
});