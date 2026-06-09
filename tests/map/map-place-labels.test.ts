import { describe, expect, it } from "vitest";

import { PLACE_TYPE_FALLBACK } from "../../src/config/brand";
import { placeTypeLabel } from "../../src/domain/place";

describe("map place labels", () => {
  it("keeps unknown future place types readable instead of falling back to an empty label", () => {
    expect(placeTypeLabel("fountain")).toBe("fountain");
    expect(placeTypeLabel("future-campus-service")).toBe("future-campus-service");
  });

  it("uses the configured fallback when the backend sends no type labels", () => {
    expect(placeTypeLabel(null, null)).toBe(PLACE_TYPE_FALLBACK);
    expect(placeTypeLabel(undefined, undefined)).toBe(PLACE_TYPE_FALLBACK);
  });
});
