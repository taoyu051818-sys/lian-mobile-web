import { describe, it, expect, afterEach, vi } from "vitest";
import { useGeolocation } from "../../src/features/publish/useGeolocation";
import {
  PUBLISH_LOCATION_GEOLOC_DENIED,
  PUBLISH_LOCATION_GEOLOC_TIMEOUT,
  PUBLISH_LOCATION_GEOLOC_UNAVAILABLE,
  PUBLISH_LOCATION_GEOLOC_UNSUPPORTED,
} from "../../src/config/brand";

interface MockGeolocationConfig {
  successPosition?: { lat: number; lng: number; accuracy?: number };
  errorCode?: number;
}

function stubGeolocation(config: MockGeolocationConfig | null) {
  if (config === null) {
    vi.stubGlobal("navigator", {});
    return;
  }
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition(success: (p: unknown) => void, error?: (e: unknown) => void) {
        if (config.successPosition) {
          success({
            coords: {
              latitude: config.successPosition.lat,
              longitude: config.successPosition.lng,
              accuracy: config.successPosition.accuracy,
            },
          });
          return;
        }
        if (typeof config.errorCode === "number") {
          error?.({ code: config.errorCode, message: "stub-error" });
        }
      },
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useGeolocation", () => {
  it("resolves coords on success", async () => {
    stubGeolocation({ successPosition: { lat: 18.4, lng: 110.0, accuracy: 12 } });
    const { fetchCurrentLocation, error, isFetching } = useGeolocation();
    expect(isFetching.value).toBe(false);
    const coords = await fetchCurrentLocation();
    expect(coords).toEqual({
      lat: 18.4,
      lng: 110.0,
      accuracy: 12,
      coordinateSystem: "wgs84",
    });
    expect(error.value).toBe("");
    expect(isFetching.value).toBe(false);
  });

  it("returns null and surfaces PERMISSION_DENIED copy", async () => {
    stubGeolocation({ errorCode: 1 });
    const { fetchCurrentLocation, error } = useGeolocation();
    const coords = await fetchCurrentLocation();
    expect(coords).toBeNull();
    expect(error.value).toBe(PUBLISH_LOCATION_GEOLOC_DENIED);
  });

  it("returns null and surfaces POSITION_UNAVAILABLE copy", async () => {
    stubGeolocation({ errorCode: 2 });
    const { fetchCurrentLocation, error } = useGeolocation();
    expect(await fetchCurrentLocation()).toBeNull();
    expect(error.value).toBe(PUBLISH_LOCATION_GEOLOC_UNAVAILABLE);
  });

  it("returns null and surfaces TIMEOUT copy", async () => {
    stubGeolocation({ errorCode: 3 });
    const { fetchCurrentLocation, error } = useGeolocation();
    expect(await fetchCurrentLocation()).toBeNull();
    expect(error.value).toBe(PUBLISH_LOCATION_GEOLOC_TIMEOUT);
  });

  it("returns null and surfaces unsupported copy when geolocation API is missing", async () => {
    stubGeolocation(null);
    const { fetchCurrentLocation, error } = useGeolocation();
    expect(await fetchCurrentLocation()).toBeNull();
    expect(error.value).toBe(PUBLISH_LOCATION_GEOLOC_UNSUPPORTED);
  });

  it("rejects non-finite coords as unavailable", async () => {
    stubGeolocation({ successPosition: { lat: Number.NaN, lng: 0 } });
    const { fetchCurrentLocation, error } = useGeolocation();
    expect(await fetchCurrentLocation()).toBeNull();
    expect(error.value).toBe(PUBLISH_LOCATION_GEOLOC_UNAVAILABLE);
  });

  it.each([
    [{ lat: 90.0001, lng: 0 }, "latitude"],
    [{ lat: 0, lng: 180.0001 }, "longitude"],
  ])("rejects out-of-range %s as unavailable", async (successPosition) => {
    stubGeolocation({ successPosition });
    const { fetchCurrentLocation, error } = useGeolocation();
    expect(await fetchCurrentLocation()).toBeNull();
    expect(error.value).toBe(PUBLISH_LOCATION_GEOLOC_UNAVAILABLE);
  });

  it("coalesces concurrent fetches — second call returns null without re-fetching", async () => {
    let calls = 0;
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition(success: (p: unknown) => void) {
          calls += 1;
          // Defer success to next tick so the second call lands while
          // isFetching is still true.
          setTimeout(
            () =>
              success({
                coords: { latitude: 1, longitude: 2 },
              }),
            0,
          );
        },
      },
    });
    const { fetchCurrentLocation } = useGeolocation();
    const [first, second] = await Promise.all([fetchCurrentLocation(), fetchCurrentLocation()]);
    expect(calls).toBe(1);
    // Whichever resolved first gets the coords; the other returns null.
    const coords = first ?? second;
    expect(coords).toEqual({
      lat: 1,
      lng: 2,
      accuracy: undefined,
      coordinateSystem: "wgs84",
    });
    expect(first === null || second === null).toBe(true);
  });

  it("invalidates a delayed browser callback before it can publish stale coordinates", async () => {
    let succeed: ((position: unknown) => void) | undefined;
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition(success: (position: unknown) => void) {
          succeed = success;
        },
      },
    });
    const { fetchCurrentLocation, invalidatePendingRequest, isFetching, error } = useGeolocation();

    const pending = fetchCurrentLocation();
    expect(isFetching.value).toBe(true);
    invalidatePendingRequest();
    succeed?.({ coords: { latitude: 18.4, longitude: 110 } });

    await expect(pending).resolves.toBeNull();
    expect(isFetching.value).toBe(false);
    expect(error.value).toBe("");
  });

  it("lets a second request finish after an invalidated first callback arrives late", async () => {
    const callbacks: Array<(position: unknown) => void> = [];
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition(success: (position: unknown) => void) {
          callbacks.push(success);
        },
      },
    });
    const { fetchCurrentLocation, invalidatePendingRequest, isFetching } = useGeolocation();

    const first = fetchCurrentLocation();
    invalidatePendingRequest();
    const second = fetchCurrentLocation();
    callbacks[0]?.({ coords: { latitude: 18.1, longitude: 109.9 } });
    await expect(first).resolves.toBeNull();
    expect(isFetching.value).toBe(true);

    callbacks[1]?.({ coords: { latitude: 18.4, longitude: 110 } });
    await expect(second).resolves.toMatchObject({
      lat: 18.4,
      lng: 110,
      coordinateSystem: "wgs84",
    });
    expect(isFetching.value).toBe(false);
  });

  it("clearError() resets the error message", async () => {
    stubGeolocation({ errorCode: 1 });
    const { fetchCurrentLocation, error, clearError } = useGeolocation();
    await fetchCurrentLocation();
    expect(error.value).not.toBe("");
    clearError();
    expect(error.value).toBe("");
  });
});
