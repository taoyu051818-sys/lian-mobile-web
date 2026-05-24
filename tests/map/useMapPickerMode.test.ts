import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useMapPickerMode } from "../../src/features/map/useMapPickerMode";
import {
  consumePendingPublishLocation,
  clearPendingPublishLocation,
} from "../../src/features/publish/usePublishLocationHandoff";
import type { MapLocation } from "../../src/types/map";

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

interface FakeWindow {
  location: { hash: string };
  history: { length: number; back: () => void };
  sessionStorage: Storage;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  dispatchHashChange: () => void;
}

let fakeWindow: FakeWindow;
let backCalls: number;

beforeEach(() => {
  backCalls = 0;
  const listeners: Record<string, Set<() => void>> = {
    hashchange: new Set(),
    popstate: new Set(),
  };
  fakeWindow = {
    location: { hash: "#/map?picker=1" },
    history: {
      length: 2,
      back: () => {
        backCalls += 1;
      },
    },
    sessionStorage: createMemoryStorage(),
    addEventListener: (event, handler) => {
      listeners[event]?.add(handler);
    },
    removeEventListener: (event, handler) => {
      listeners[event]?.delete(handler);
    },
    dispatchHashChange: () => {
      listeners.hashchange?.forEach((h) => h());
    },
  };
  vi.stubGlobal("window", fakeWindow);
  clearPendingPublishLocation();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeLocation(overrides: Partial<MapLocation> = {}): MapLocation {
  return {
    id: "loc-1",
    name: "图书馆",
    lat: 18.39,
    lng: 110.01,
    place: { id: "p-1", name: "图书馆", type: "library" },
    ...overrides,
  };
}

describe("useMapPickerMode — picker flag", () => {
  it("isPickerMode is true when hash contains picker=1", () => {
    const picker = useMapPickerMode();
    expect(picker.isPickerMode.value).toBe(true);
  });

  it("isPickerMode is false on the regular map hash", () => {
    fakeWindow.location.hash = "#/map";
    const picker = useMapPickerMode();
    expect(picker.isPickerMode.value).toBe(false);
  });

  it("isPickerMode is false when picker param is set to anything other than 1", () => {
    fakeWindow.location.hash = "#/map?picker=true";
    const picker = useMapPickerMode();
    expect(picker.isPickerMode.value).toBe(false);
  });

  it("uses the injected hashSource when provided and reacts to hashchange events", () => {
    let hash = "#/map";
    const picker = useMapPickerMode({ hashSource: () => hash });
    expect(picker.isPickerMode.value).toBe(false);
    hash = "#/map?picker=1";
    fakeWindow.dispatchHashChange();
    expect(picker.isPickerMode.value).toBe(true);
  });
});

describe("useMapPickerMode — selection state", () => {
  it("selectLocation stores the chosen MapLocation and clears any pin", () => {
    const picker = useMapPickerMode();
    picker.dropPin({ lat: 1, lng: 2 });
    const loc = makeLocation();
    picker.selectLocation(loc);
    expect(picker.selection.value.location).toStrictEqual(loc);
    expect(picker.selection.value.pin).toBeNull();
    expect(picker.hasSelection.value).toBe(true);
  });

  it("dropPin stores the coords and clears any selected place", () => {
    const picker = useMapPickerMode();
    picker.selectLocation(makeLocation());
    picker.dropPin({ lat: 18.4, lng: 110.0 });
    expect(picker.selection.value.location).toBeNull();
    expect(picker.selection.value.pin).toEqual({ lat: 18.4, lng: 110.0 });
  });

  it("clearSelection wipes both", () => {
    const picker = useMapPickerMode();
    picker.dropPin({ lat: 1, lng: 2 });
    picker.clearSelection();
    expect(picker.hasSelection.value).toBe(false);
  });
});

describe("useMapPickerMode — confirm / cancel", () => {
  it("confirm with a known place writes a `place` handoff and steps history back", () => {
    const picker = useMapPickerMode();
    picker.selectLocation(makeLocation());
    expect(picker.confirm()).toBe(true);
    expect(backCalls).toBe(1);
    const handoff = consumePendingPublishLocation();
    expect(handoff).toEqual({
      kind: "place",
      placeId: "p-1",
      name: "图书馆",
      type: "library",
      lat: 18.39,
      lng: 110.01,
    });
  });

  it("confirm with a free pin writes a `coords` handoff", () => {
    const picker = useMapPickerMode();
    picker.dropPin({ lat: 18.42, lng: 110.05 });
    expect(picker.confirm()).toBe(true);
    expect(consumePendingPublishLocation()).toEqual({
      kind: "coords",
      lat: 18.42,
      lng: 110.05,
    });
  });

  it("confirm with a place that lacks a stable id falls back to coords + label", () => {
    const picker = useMapPickerMode();
    picker.selectLocation(makeLocation({ place: undefined, placeId: "" }));
    picker.confirm();
    expect(consumePendingPublishLocation()).toEqual({
      kind: "coords",
      lat: 18.39,
      lng: 110.01,
      label: "图书馆",
    });
  });

  it("confirm without a selection does nothing", () => {
    const picker = useMapPickerMode();
    expect(picker.confirm()).toBe(false);
    expect(backCalls).toBe(0);
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("cancel clears selection, navigates back, and writes no handoff", () => {
    const picker = useMapPickerMode();
    picker.dropPin({ lat: 1, lng: 2 });
    picker.cancel();
    expect(picker.hasSelection.value).toBe(false);
    expect(backCalls).toBe(1);
    expect(consumePendingPublishLocation()).toBeNull();
  });

  it("falls back to hash assignment when there is no history to step back to", () => {
    fakeWindow.history.length = 1;
    const picker = useMapPickerMode();
    picker.dropPin({ lat: 1, lng: 2 });
    picker.confirm();
    expect(backCalls).toBe(0);
    expect(fakeWindow.location.hash).toBe("#/publish");
  });
});
