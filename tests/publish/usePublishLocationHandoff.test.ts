import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  consumePendingPublishLocation,
  setPendingPublishLocation,
  clearPendingPublishLocation,
  PUBLISH_LOCATION_HANDOFF_KEY,
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

let storage: Storage;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal("window", { sessionStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePublishLocationHandoff", () => {
  it("round-trips a place payload", () => {
    setPendingPublishLocation({
      kind: "place",
      placeId: "p-1",
      name: "图书馆",
      type: "library",
      lat: 18.39,
      lng: 110.01,
    });
    const payload = consumePendingPublishLocation();
    expect(payload).toEqual({
      kind: "place",
      placeId: "p-1",
      name: "图书馆",
      type: "library",
      lat: 18.39,
      lng: 110.01,
    });
  });

  it("round-trips a coords payload", () => {
    setPendingPublishLocation({ kind: "coords", lat: 18.4, lng: 110.0, label: "宿舍楼下" });
    expect(consumePendingPublishLocation()).toEqual({
      kind: "coords",
      lat: 18.4,
      lng: 110.0,
      label: "宿舍楼下",
    });
  });

  it("returns null when nothing is pending", () => {
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("consume is destructive — a second read returns null", () => {
    setPendingPublishLocation({ kind: "coords", lat: 1, lng: 2 });
    expect(consumePendingPublishLocation()).not.toBeNull();
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("rejects malformed payloads at write time without poisoning storage", () => {
    setPendingPublishLocation({
      kind: "place",
      placeId: "",
      name: "图书馆",
      lat: 1,
      lng: 2,
    } as unknown as Parameters<typeof setPendingPublishLocation>[0]);
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("rejects coords without finite lat/lng", () => {
    setPendingPublishLocation({
      kind: "coords",
      lat: Number.NaN,
      lng: 0,
    } as unknown as Parameters<typeof setPendingPublishLocation>[0]);
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("ignores malformed entries written manually to storage and clears them", () => {
    storage.setItem(PUBLISH_LOCATION_HANDOFF_KEY, "{not-json}");
    expect(consumePendingPublishLocation()).toBeNull();
    expect(storage.getItem(PUBLISH_LOCATION_HANDOFF_KEY)).toBeNull();
  });

  it("ignores entries with an unknown kind", () => {
    storage.setItem(
      PUBLISH_LOCATION_HANDOFF_KEY,
      JSON.stringify({ kind: "weird", lat: 1, lng: 2 }),
    );
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("clearPendingPublishLocation drops the entry without consuming it", () => {
    setPendingPublishLocation({ kind: "coords", lat: 1, lng: 2 });
    clearPendingPublishLocation();
    expect(storage.getItem(PUBLISH_LOCATION_HANDOFF_KEY)).toBeNull();
  });

  it("survives missing sessionStorage", () => {
    vi.stubGlobal("window", {});
    expect(() => setPendingPublishLocation({ kind: "coords", lat: 1, lng: 2 })).not.toThrow();
    expect(consumePendingPublishLocation()).toBeNull();
  });
});
