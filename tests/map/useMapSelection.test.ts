import test from "node:test";
import assert from "node:assert/strict";

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

// --- placeIdForLocation ---

test("placeIdForLocation returns place.id when present", () => {
  const location = makeLocation({ place: { id: "p-1", name: "图书馆" } });
  assert.equal(placeIdForLocation(location), "p-1");
});

test("placeIdForLocation returns placeId when place.id is absent", () => {
  const location = makeLocation({ placeId: "pid-2" });
  assert.equal(placeIdForLocation(location), "pid-2");
});

test("placeIdForLocation prefers place.id over placeId", () => {
  const location = makeLocation({
    placeId: "pid-2",
    place: { id: "p-1", name: "图书馆" },
  });
  assert.equal(placeIdForLocation(location), "p-1");
});

test("placeIdForLocation returns empty string when neither exists", () => {
  const location = makeLocation();
  assert.equal(placeIdForLocation(location), "");
});

// --- hasStablePlaceRef ---

test("hasStablePlaceRef returns true when place.id exists", () => {
  const location = makeLocation({ place: { id: "p-1", name: "图书馆" } });
  assert.equal(hasStablePlaceRef(location), true);
});

test("hasStablePlaceRef returns true when placeId exists", () => {
  const location = makeLocation({ placeId: "pid-2" });
  assert.equal(hasStablePlaceRef(location), true);
});

test("hasStablePlaceRef returns false when neither exists", () => {
  const location = makeLocation();
  assert.equal(hasStablePlaceRef(location), false);
});

test("hasStablePlaceRef returns false for empty string placeId", () => {
  const location = makeLocation({ placeId: "" });
  assert.equal(hasStablePlaceRef(location), false);
});
