import { describe, expect, it } from "vitest";

import { placeIdForLocation, hasStablePlaceRef } from "../../src/features/map/useMapSelection.ts";
import type { MapLocation } from "../../src/types/map.ts";

function makeLocation(overrides: Partial<MapLocation> = {}): MapLocation {
  return {
    id: "loc-1",
    name: "图书馆",
    lat: 18.39,
    lng: 110.01,
    ...overrides,
  };
}

describe("useMapSelection helpers", () => {
  // --- placeIdForLocation ---

  it("placeIdForLocation returns place.id when present", () => {
    const location = makeLocation({ place: { id: "p-1", name: "图书馆" } });
    expect(placeIdForLocation(location)).toBe("p-1");
  });

  it("placeIdForLocation returns placeId when place.id is absent", () => {
    const location = makeLocation({ placeId: "pid-2" });
    expect(placeIdForLocation(location)).toBe("pid-2");
  });

  it("placeIdForLocation prefers place.id over placeId", () => {
    const location = makeLocation({
      placeId: "pid-2",
      place: { id: "p-1", name: "图书馆" },
    });
    expect(placeIdForLocation(location)).toBe("p-1");
  });

  it("placeIdForLocation returns empty string when neither exists", () => {
    const location = makeLocation();
    expect(placeIdForLocation(location)).toBe("");
  });

  // --- hasStablePlaceRef ---

  it("hasStablePlaceRef returns true when place.id exists", () => {
    const location = makeLocation({ place: { id: "p-1", name: "图书馆" } });
    expect(hasStablePlaceRef(location)).toBe(true);
  });

  it("hasStablePlaceRef returns true when placeId exists", () => {
    const location = makeLocation({ placeId: "pid-2" });
    expect(hasStablePlaceRef(location)).toBe(true);
  });

  it("hasStablePlaceRef returns false when neither exists", () => {
    const location = makeLocation();
    expect(hasStablePlaceRef(location)).toBe(false);
  });

  it("hasStablePlaceRef returns false for empty string placeId", () => {
    const location = makeLocation({ placeId: "" });
    expect(hasStablePlaceRef(location)).toBe(false);
  });
});
