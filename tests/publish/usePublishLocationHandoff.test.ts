import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingPublishLocation,
  consumePendingPublishLocation,
  PUBLISH_LOCATION_HANDOFF_KEY,
  setPendingPublishLocation,
} from "../../src/features/publish/usePublishLocationHandoff";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

const MAP_PLACE = {
  version: 2 as const,
  source: "map_picker" as const,
  coordinateSystem: "gcj02" as const,
  kind: "place" as const,
  locationId: "loc-1",
  placeId: "p-1",
  name: "图书馆",
  type: "library",
  lat: 18.39,
  lng: 110.01,
};

const MAP_PIN = {
  version: 2 as const,
  source: "map_picker" as const,
  coordinateSystem: "gcj02" as const,
  kind: "coords" as const,
  lat: 18.4,
  lng: 110,
  label: "宿舍楼下",
};

const BROWSER_LOCATION = {
  version: 2 as const,
  source: "browser_geolocation" as const,
  coordinateSystem: "wgs84" as const,
  kind: "coords" as const,
  lat: 18.401,
  lng: 110.002,
  accuracy: 12,
};

let storage: Storage;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal("window", { sessionStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePublishLocationHandoff v2", () => {
  it.each([
    ["known map place", MAP_PLACE],
    ["free map pin", MAP_PIN],
    ["browser WGS84 location", BROWSER_LOCATION],
  ])("round-trips %s without changing source or coordinates", (_label, payload) => {
    setPendingPublishLocation(payload);
    expect(consumePendingPublishLocation()).toEqual(payload);
  });

  it("keeps the storage key and writes an explicit version", () => {
    setPendingPublishLocation(MAP_PIN);
    expect(JSON.parse(storage.getItem(PUBLISH_LOCATION_HANDOFF_KEY) || "null")).toMatchObject({
      version: 2,
      source: "map_picker",
      coordinateSystem: "gcj02",
    });
  });

  it("normalizes a legacy place to map-picker GCJ-02 without inventing a locationId", () => {
    storage.setItem(
      PUBLISH_LOCATION_HANDOFF_KEY,
      JSON.stringify({
        kind: "place",
        placeId: "legacy-place",
        name: "旧图书馆",
        type: "library",
        lat: 18.39,
        lng: 110.01,
      }),
    );
    expect(consumePendingPublishLocation()).toEqual({
      version: 2,
      source: "map_picker",
      coordinateSystem: "gcj02",
      kind: "place",
      placeId: "legacy-place",
      name: "旧图书馆",
      type: "library",
      lat: 18.39,
      lng: 110.01,
    });
  });

  it("normalizes ambiguous legacy coords to display-only unknown coordinates", () => {
    storage.setItem(
      PUBLISH_LOCATION_HANDOFF_KEY,
      JSON.stringify({ kind: "coords", lat: 18.4, lng: 110, label: "旧坐标" }),
    );
    expect(consumePendingPublishLocation()).toEqual({
      version: 1,
      source: "legacy",
      coordinateSystem: "unknown",
      kind: "coords",
      lat: 18.4,
      lng: 110,
      label: "旧坐标",
    });
  });

  it.each([
    ["unknown version", { ...MAP_PIN, version: 3 }],
    ["map/WGS mismatch", { ...MAP_PIN, coordinateSystem: "wgs84" }],
    ["browser/GCJ mismatch", { ...BROWSER_LOCATION, coordinateSystem: "gcj02" }],
    ["latitude above range", { ...MAP_PIN, lat: 90.0001 }],
    ["longitude below range", { ...MAP_PIN, lng: -180.0001 }],
    ["missing longitude", { ...MAP_PIN, lng: undefined }],
    ["negative accuracy", { ...BROWSER_LOCATION, accuracy: -1 }],
  ])("rejects and destructively clears %s", (_label, raw) => {
    storage.setItem(PUBLISH_LOCATION_HANDOFF_KEY, JSON.stringify(raw));
    expect(consumePendingPublishLocation()).toBeNull();
    expect(storage.getItem(PUBLISH_LOCATION_HANDOFF_KEY)).toBeNull();
  });

  it("returns null when nothing is pending", () => {
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("consume is destructive", () => {
    setPendingPublishLocation(MAP_PIN);
    expect(consumePendingPublishLocation()).toEqual(MAP_PIN);
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("uses the newest valid action when browser location replaces a pending map pick", () => {
    setPendingPublishLocation(MAP_PLACE);
    setPendingPublishLocation(BROWSER_LOCATION);
    expect(consumePendingPublishLocation()).toEqual(BROWSER_LOCATION);
  });

  it("rejects malformed writes and clears an older pending action", () => {
    setPendingPublishLocation(MAP_PIN);
    setPendingPublishLocation({ ...MAP_PLACE, placeId: "" });
    expect(storage.getItem(PUBLISH_LOCATION_HANDOFF_KEY)).toBeNull();
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("ignores malformed JSON and clears it", () => {
    storage.setItem(PUBLISH_LOCATION_HANDOFF_KEY, "{not-json}");
    expect(consumePendingPublishLocation()).toBeNull();
    expect(storage.getItem(PUBLISH_LOCATION_HANDOFF_KEY)).toBeNull();
  });

  it("clearPendingPublishLocation drops the entry without consuming it", () => {
    setPendingPublishLocation(MAP_PIN);
    clearPendingPublishLocation();
    expect(storage.getItem(PUBLISH_LOCATION_HANDOFF_KEY)).toBeNull();
  });

  it("survives missing sessionStorage", () => {
    vi.stubGlobal("window", {});
    expect(() => setPendingPublishLocation(MAP_PIN)).not.toThrow();
    expect(consumePendingPublishLocation()).toBeNull();
  });
});
