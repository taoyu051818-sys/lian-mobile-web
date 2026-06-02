import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_LOAD_PLACE } from "../../src/config/brand";
import {
  placeIdForLocation,
  hasStablePlaceRef,
  useMapSelection,
} from "../../src/features/map/useMapSelection.ts";
import type { MapLocation } from "../../src/types/map.ts";

const fetchPlaceSheetMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/api/places", () => ({
  fetchPlaceSheet: fetchPlaceSheetMock,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

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
  beforeEach(() => {
    fetchPlaceSheetMock.mockReset();
  });

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

  it("opens the selected location and stores the backend place sheet DTO", async () => {
    const selection = useMapSelection(() => []);
    const request = deferred({
      id: "p-1",
      name: "后端图书馆",
      type: "library",
      status: "official" as const,
      summary: { text: "后端汇总" },
    });
    fetchPlaceSheetMock.mockReturnValueOnce(request.promise);

    selection.openPlaceSheet(makeLocation({ place: { id: "p-1", name: "图书馆" } }));
    expect(selection.placeSheetLoading.value).toBe(true);
    expect(selection.selectedPlaceSheet.value).toBeNull();

    request.resolve({
      id: "p-1",
      name: "后端图书馆",
      type: "library",
      status: "official" as const,
      summary: { text: "后端汇总" },
    });
    await flushPromises();

    expect(fetchPlaceSheetMock).toHaveBeenCalledWith("p-1");
    expect(selection.placeSheetLoading.value).toBe(false);
    expect(selection.placeSheetError.value).toBe("");
    expect(selection.selectedPlaceSheet.value).toEqual({
      id: "p-1",
      name: "后端图书馆",
      type: "library",
      status: "official",
      summary: { text: "后端汇总" },
    });
  });

  it("preserves empty state when the selected location has no stable place id", () => {
    const selection = useMapSelection(() => []);

    selection.openPlaceSheet(makeLocation());

    expect(fetchPlaceSheetMock).not.toHaveBeenCalled();
    expect(selection.placeSheetLoading.value).toBe(false);
    expect(selection.placeSheetError.value).toBe("");
    expect(selection.selectedPlaceSheet.value).toBeNull();
  });

  it("surfaces a friendly error and clears loading when the backend DTO request fails", async () => {
    const selection = useMapSelection(() => []);
    const request = deferred<never>();
    fetchPlaceSheetMock.mockReturnValueOnce(request.promise);

    selection.openPlaceSheet(makeLocation({ placeId: "p-4" }));
    expect(selection.placeSheetLoading.value).toBe(true);

    request.reject(new Error(""));
    await flushPromises();

    expect(selection.placeSheetLoading.value).toBe(false);
    expect(selection.selectedPlaceSheet.value).toBeNull();
    expect(selection.placeSheetError.value).toBe(ERROR_LOAD_PLACE);
  });

  it("ignores stale DTOs when the same place reopens before the first request resolves", async () => {
    const selection = useMapSelection(() => []);
    const firstRequest = deferred({ id: "p-1", name: "旧地点", status: "official" as const });
    const secondRequest = deferred({ id: "p-1", name: "新地点", status: "official" as const });
    fetchPlaceSheetMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    selection.openPlaceSheet(makeLocation({ placeId: "p-1" }));
    selection.closePlaceSheet();
    selection.openPlaceSheet(makeLocation({ placeId: "p-1" }));

    secondRequest.resolve({ id: "p-1", name: "新地点", status: "official" as const });
    await flushPromises();
    firstRequest.resolve({ id: "p-1", name: "旧地点", status: "official" as const });
    await flushPromises();

    expect(fetchPlaceSheetMock).toHaveBeenCalledTimes(2);
    expect(selection.selectedPlaceSheet.value).toEqual({
      id: "p-1",
      name: "新地点",
      status: "official",
    });
    expect(selection.placeSheetLoading.value).toBe(false);
  });

  it("clears loading and ignores stale DTOs when the sheet closes mid-request", async () => {
    const selection = useMapSelection(() => []);
    const request = deferred({ id: "p-3", name: "旧地点", status: "official" as const });
    fetchPlaceSheetMock.mockReturnValueOnce(request.promise);

    selection.openPlaceSheet(makeLocation({ placeId: "p-3" }));
    expect(selection.placeSheetLoading.value).toBe(true);

    selection.closePlaceSheet();
    expect(selection.placeSheetLoading.value).toBe(false);

    request.resolve({ id: "p-3", name: "旧地点", status: "official" as const });
    await flushPromises();

    expect(selection.selectedPlaceSheet.value).toBeNull();
    expect(selection.placeSheetError.value).toBe("");
    expect(selection.placeSheetLoading.value).toBe(false);
  });
});
